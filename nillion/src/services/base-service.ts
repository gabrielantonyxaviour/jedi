import { nillionConfig } from "../config/nillion";

let SecretVaultWrapper: any;

export abstract class BaseService<T> {
  protected collection: any;
  private initialized = false;

  constructor(private schemaId: string) {}

  async init(): Promise<void> {
    if (!this.initialized) {
      if (!SecretVaultWrapper) {
        const secretvaults = await import("secretvaults");
        SecretVaultWrapper = secretvaults.SecretVaultWrapper;
      }

      this.collection = new SecretVaultWrapper(
        nillionConfig.nodes,
        nillionConfig.orgCredentials,
        this.schemaId
      );

      await this.collection.init();
      this.initialized = true;
    }
  }

  async create(data: T[]): Promise<string[]> {
    await this.init();
    const result = await this.collection.writeToNodes(data);
    return result.flatMap((item: any) => item.data.created || []);
  }

  async findAll(filter: Record<string, any> = {}): Promise<T[]> {
    await this.init();
    return await this.collection.readFromNodes(filter);
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
