import axios from "axios";

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
      const shares = [
        Buffer.from(data + "_share1").toString("base64"),
        Buffer.from(data + "_share2").toString("base64"),
        Buffer.from(data + "_share3").toString("base64"),
      ];
      return shares;
    },

    async decrypt(shares: string[]): Promise<string> {
      if (shares.length < 3) throw new Error("Insufficient shares");
      const decoded = Buffer.from(shares[0], "base64").toString();
      return decoded.replace("_share1", "");
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
      `https://node${nodeIndex}.example.com/upload`,
      { data, schema_id: schemaId },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
    return response.status === 200;
  } catch (error) {
    console.error(`Node ${nodeIndex} upload failed:`, error);
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
      `https://node${nodeIndex}.example.com/fetch?schema_id=${schemaId}`,
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
    return response.data || [];
  } catch (error) {
    console.error(`Node ${nodeIndex} fetch failed:`, error);
    return [];
  }
}
