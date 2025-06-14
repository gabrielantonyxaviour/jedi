import { nilql } from "@nillion/nilql";
import { nillionConfig } from "../config/nillion.js";

export class EncryptionService {
  private secretKey: any;
  private initialized = false;

  async init(): Promise<void> {
    if (!this.initialized) {
      const cluster = {
        nodes: nillionConfig.nodes.map((node) => ({
          url: node.url,
          did: node.did,
        })),
      };

      this.secretKey = await nilql.ClusterKey.generate(cluster, {
        store: true,
        match: true,
        sum: true,
      });

      this.initialized = true;
    }
  }

  async encryptForStorage(data: string): Promise<string[]> {
    await this.init();
    const shares = await nilql.encrypt(this.secretKey, data);
    return Array.isArray(shares) ? (shares as string[]) : [shares as string];
  }

  async decryptFromStorage(shares: string[]): Promise<string> {
    await this.init();
    const decrypted = await nilql.decrypt(this.secretKey, shares);
    return decrypted as string;
  }

  async encryptForSum(value: number): Promise<string[]> {
    await this.init();
    const shares = await nilql.encrypt(this.secretKey, value);
    return Array.isArray(shares) ? (shares as string[]) : [shares as string];
  }

  async decryptSum(shares: string[]): Promise<number> {
    await this.init();
    const decrypted = await nilql.decrypt(this.secretKey, shares);
    return Number(decrypted);
  }
}

export const encryptionService = new EncryptionService();
