import axios from "axios";
import { NODE_URLS } from "@/lib/nilion";

interface EncryptionService {
  encrypt(data: string): Promise<string[]>;
  decrypt(shares: string[]): Promise<string>;
}

export async function generateJWTs(): Promise<string[]> {
  return ["jwt_token_1", "jwt_token_2", "jwt_token_3"];
}

export async function createEncryptionService(): Promise<EncryptionService> {
  return {
    async encrypt(data: string): Promise<string[]> {
      return [
        Buffer.from(data + "_s1").toString("base64"),
        Buffer.from(data + "_s2").toString("base64"),
        Buffer.from(data + "_s3").toString("base64"),
      ];
    },
    async decrypt(shares: string[]): Promise<string> {
      return Buffer.from(shares[0], "base64").toString().replace("_s1", "");
    },
  };
}

export async function uploadToNode(
  nodeIndex: number,
  data: any,
  jwt: string,
  schemaId: string
): Promise<boolean> {
  try {
    const response = await axios.post(
      `${NODE_URLS[nodeIndex]}/upload`,
      { data, schema_id: schemaId },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
    return response.status === 200;
  } catch {
    return false;
  }
}

export async function fetchFromNode(
  nodeIndex: number,
  jwt: string,
  schemaId: string
): Promise<any[]> {
  try {
    const response = await axios.get(
      `${NODE_URLS[nodeIndex]}/fetch?schema_id=${schemaId}`,
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
    return response.data || [];
  } catch {
    return [];
  }
}
