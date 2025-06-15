import { SecretVaultWrapper } from "secretvaults";
import { nillionConfig } from "../config/nillion.js";
import { v4 as uuidv4 } from "uuid";

export abstract class BaseService<T> {
  protected collection: SecretVaultWrapper;
  private initialized = false;

  constructor(private schemaId: string) {
    this.collection = new SecretVaultWrapper(
      nillionConfig.nodes,
      nillionConfig.orgCredentials,
      schemaId
    );
  }

  async init(): Promise<void> {
    if (!this.initialized) {
      await this.collection.init();
      this.initialized = true;
    }
  }

  protected encryptField(value: string): { "%share": string } {
    return { "%share": value };
  }

  protected generateId(): string {
    return uuidv4();
  }

  async create(data: T[]): Promise<string[]> {
    await this.init();
    const result = await this.collection.writeToNodes(data);

    const successful = result.filter((item) => item.data?.created);
    const failed = result.filter((item) => !item.data?.created);

    if (successful.length === 0) {
      throw new Error(
        `All nodes failed: ${failed
          .map((f: any) => f.error || f.status)
          .join(", ")}`
      );
    }

    if (failed.length > 0 && failed.length < result.length) {
      console.warn(
        `⚠️ ${failed.length}/${result.length} nodes failed, but operation succeeded`
      );
    }

    return successful.flatMap((item) => item.data.created);
  }

  async findAll(filter: Record<string, any> = {}): Promise<T[]> {
    await this.init();
    try {
      return await this.collection.readFromNodes(filter);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("401")) {
        console.warn(
          "⚠️ Some nodes failed auth, but data may still be available"
        );
        return [];
      }
      throw error;
    }
  }

  async findById(id: string): Promise<T | null> {
    await this.init();
    const results = await this.collection.readFromNodes({ _id: id });
    return results.length > 0 ? results[0] : null;
  }

  async update(id: string, data: Partial<T>): Promise<boolean> {
    await this.init();
    try {
      await this.collection.updateFromNodes(id, data);
      return true;
    } catch (error) {
      console.error(`Update failed:`, error);
      return false;
    }
  }

  async delete(id: string): Promise<boolean> {
    await this.init();
    try {
      await this.collection.deleteFromNodes(id);
      return true;
    } catch (error) {
      console.error(`Delete failed:`, error);
      return false;
    }
  }

  async query(
    pipeline: any[],
    variables?: Record<string, any>
  ): Promise<any[]> {
    await this.init();
    throw new Error(
      "Query functionality not yet implemented in secretvaults wrapper"
    );
  }
}
