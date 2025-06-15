// compliance-manager.ts
import { v4 as uuidv4 } from "uuid";
import { nilql } from "@nillion/nilql";
import { createJWT, ES256KSigner } from "did-jwt";
import { nillionConfig } from "./config/nillion";

// JWT Configuration - replace with your values
const SECRET_KEY = nillionConfig.orgCredentials.secretKey; // hex string of private key
const ORG_DID = nillionConfig.orgCredentials.orgDid;
const NODE_IDS = [
  nillionConfig.nodes[0].did,
  nillionConfig.nodes[1].did,
  nillionConfig.nodes[2].did,
];
const NODE_URLS = [
  nillionConfig.nodes[0].url,
  nillionConfig.nodes[1].url,
  nillionConfig.nodes[2].url,
];

const SCHEMA_ID = "e680560f-164e-4605-b1a4-885689164a95";

// Generate JWTs
async function generateJWTs(): Promise<string[]> {
  const signer = ES256KSigner(Buffer.from(SECRET_KEY, "hex"));
  const tokens = [];

  for (const nodeId of NODE_IDS) {
    const payload = {
      iss: ORG_DID,
      aud: nodeId,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    };
    const token = await createJWT(payload, { issuer: ORG_DID, signer });
    tokens.push(token);
  }
  return tokens;
}

// Types
interface ComplianceRecord {
  _id: string;
  name: { "%share": string };
  source: { "%share": string };
  data: { "%share": string };
}

interface ComplianceData {
  name: string;
  source: string;
  data: string;
}

// Initialize encryption service
async function createEncryptionService() {
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

// API functions
async function uploadToNode(
  nodeIndex: number,
  record: ComplianceRecord,
  jwt: string
): Promise<boolean> {
  try {
    const response = await fetch(`${NODE_URLS[nodeIndex]}/api/v1/data/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schema: SCHEMA_ID,
        data: [record],
      }),
    });
    return response.ok;
  } catch (error) {
    console.error(`Failed to upload to node ${nodeIndex}:`, error);
    return false;
  }
}

async function fetchFromNode(
  nodeIndex: number,
  jwt: string
): Promise<ComplianceRecord[]> {
  try {
    const response = await fetch(`${NODE_URLS[nodeIndex]}/api/v1/data/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schema: SCHEMA_ID,
        filter: {},
      }),
    });
    const result = (await response.json()) as { data: ComplianceRecord[] };
    return result.data || [];
  } catch (error) {
    console.error(`Failed to fetch from node ${nodeIndex}:`, error);
    return [];
  }
}

// Main functions
export async function pushComplianceData(
  data: ComplianceData
): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);

  const recordId = uuidv4();

  const [nameShares, sourceShares, dataShares] = await Promise.all([
    encryption.encrypt(data.name),
    encryption.encrypt(data.source),
    encryption.encrypt(data.data),
  ]);

  const results = await Promise.all(
    NODE_URLS.map((_, index) =>
      uploadToNode(
        index,
        {
          _id: recordId,
          name: { "%share": nameShares[index] },
          source: { "%share": sourceShares[index] },
          data: { "%share": dataShares[index] },
        },
        jwts[index]
      )
    )
  );

  return results.every(Boolean);
}

export async function fetchComplianceData(): Promise<ComplianceData[]> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);

  const allRecords = await Promise.all(
    NODE_URLS.map((_, index) => fetchFromNode(index, jwts[index]))
  );

  // Aggregate by _id
  const recordMap = new Map<
    string,
    {
      nameShares: string[];
      sourceShares: string[];
      dataShares: string[];
    }
  >();

  allRecords.flat().forEach((record) => {
    if (!recordMap.has(record._id)) {
      recordMap.set(record._id, {
        nameShares: [],
        sourceShares: [],
        dataShares: [],
      });
    }
    const entry = recordMap.get(record._id)!;
    entry.nameShares.push(record.name["%share"]);
    entry.sourceShares.push(record.source["%share"]);
    entry.dataShares.push(record.data["%share"]);
  });

  // Decrypt complete records
  const decryptedRecords: ComplianceData[] = [];

  for (const entry of Array.from(recordMap.entries())) {
    const [id, shares] = entry;
    if (shares.nameShares.length === NODE_URLS.length) {
      try {
        const [name, source, data] = await Promise.all([
          encryption.decrypt(shares.nameShares),
          encryption.decrypt(shares.sourceShares),
          encryption.decrypt(shares.dataShares),
        ]);
        decryptedRecords.push({ name, source, data });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }

  return decryptedRecords;
}

// Example usage
async function main() {
  const success = await pushComplianceData({
    name: "GDPR Compliance Report",
    source: "EU Data Protection Officer",
    data: "All customer data properly anonymized and stored according to GDPR requirements.",
  });

  console.log(success ? "✓ Data pushed" : "✗ Push failed");

  const records = await fetchComplianceData();
  console.log("Records:", records);
}

if (require.main === module) {
  main().catch(console.error);
}
