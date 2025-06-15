import { v4 as uuidv4 } from "uuid";
import { nilql } from "@nillion/nilql";
import { createJWT, ES256KSigner } from "did-jwt";
import { nillionConfig } from "./config";

const SECRET_KEY = nillionConfig.orgCredentials.secretKey;
const ORG_DID = nillionConfig.orgCredentials.orgDid;
const NODE_IDS = nillionConfig.nodes.map((node) => node.did);
const NODE_URLS = nillionConfig.nodes.map((node) => node.url);

export async function generateJWTs(): Promise<string[]> {
  const signer = ES256KSigner(Buffer.from(SECRET_KEY, "hex"));
  const tokens: string[] = [];

  for (const nodeId of NODE_IDS) {
    const payload = {
      iss: ORG_DID,
      aud: nodeId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await createJWT(payload, { issuer: ORG_DID, signer });
    tokens.push(token);
  }
  return tokens;
}

export async function createEncryptionService() {
  const cluster = { nodes: Array(NODE_URLS.length).fill({}) };
  const secretKey = await nilql.ClusterKey.generate(cluster, { store: true });

  return {
    async encrypt(text: string): Promise<string[]> {
      const shares = await nilql.encrypt(secretKey, text);
      return shares as string[];
    },
    async decrypt(shares: string[]): Promise<string> {
      return (await nilql.decrypt(secretKey, shares)) as string;
    },
  };
}

export async function uploadToNode(
  nodeIndex: number,
  record: any,
  jwt: string,
  schemaId: string
): Promise<boolean> {
  try {
    const response = await fetch(`${NODE_URLS[nodeIndex]}/api/v1/data/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schema: schemaId,
        data: [record],
      }),
    });
    return response.ok;
  } catch (error) {
    console.error(`Failed to upload to node ${nodeIndex}:`, error);
    return false;
  }
}

export async function fetchFromNode(
  nodeIndex: number,
  jwt: string,
  schemaId: string
): Promise<any[]> {
  try {
    const response = await fetch(`${NODE_URLS[nodeIndex]}/api/v1/data/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schema: schemaId,
        filter: {},
      }),
    });
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error(`Failed to fetch from node ${nodeIndex}:`, error);
    return [];
  }
}

export async function encryptFields(
  encryption: any,
  fields: string[]
): Promise<Record<string, string[]>> {
  const encrypted: Record<string, string[]> = {};
  for (const field of fields) {
    encrypted[field] = await encryption.encrypt(field);
  }
  return encrypted;
}

export async function decryptShares(
  encryption: any,
  shares: Record<string, string[]>
): Promise<Record<string, string>> {
  const decrypted: Record<string, string> = {};
  for (const [field, fieldShares] of Object.entries(shares)) {
    decrypted[field] = await encryption.decrypt(fieldShares);
  }
  return decrypted;
}

export async function updateAtNode(
  nodeIndex: number,
  recordId: string,
  updates: any,
  jwt: string,
  schemaId: string
): Promise<boolean> {
  try {
    const response = await fetch(`${NODE_URLS[nodeIndex]}/api/v1/data/update`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schema: schemaId,
        filter: { _id: recordId },
        update: updates,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error(`Failed to update at node ${nodeIndex}:`, error);
    return false;
  }
}

// Add this to base.ts
export async function updateRecord<T>(
  recordId: string,
  updates: Partial<T>,
  schemaId: string,
  fieldsToEncrypt: (keyof T)[]
): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);

  const encryptedUpdates: any = {};

  // Process each field in updates
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      if (fieldsToEncrypt.includes(key as keyof T)) {
        // Encrypt this field
        const shares = await encryption.encrypt(String(value));
        encryptedUpdates[key] = { "%share": shares };
      } else {
        // Keep as plaintext
        encryptedUpdates[key] = value;
      }
    }
  }

  // Update across all nodes
  const results = await Promise.all(
    [0, 1, 2].map((index) => {
      const nodeUpdate: any = {};

      // Build node-specific updates
      Object.keys(encryptedUpdates).forEach((key) => {
        if (encryptedUpdates[key] && encryptedUpdates[key]["%share"]) {
          nodeUpdate[key] = {
            "%share": encryptedUpdates[key]["%share"][index],
          };
        } else {
          nodeUpdate[key] = encryptedUpdates[key];
        }
      });

      return updateAtNode(index, recordId, nodeUpdate, jwts[index], schemaId);
    })
  );

  return results.every(Boolean);
}
