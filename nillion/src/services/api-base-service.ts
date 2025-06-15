// src/services/api-base-service.ts
import jwt from "jsonwebtoken";
import { nilql } from "@nillion/nilql";
import { nillionConfig } from "../config/nillion.js";
import { v4 as uuidv4 } from "uuid";

export abstract class ApiBaseService<T> {
  private clusterKey: any = null;

  constructor(private schemaId: string) {}

  private async initClusterKey(): Promise<void> {
    if (!this.clusterKey) {
      const cluster = {
        nodes: nillionConfig.nodes.map((node) => ({
          url: node.url,
          did: node.did,
        })),
      };

      this.clusterKey = await nilql.ClusterKey.generate(cluster, {
        store: true,
        match: true,
        sum: true,
      });
    }
  }

  private generateNodeToken(nodeDid: string): string {
    const payload = {
      sub: nillionConfig.orgCredentials.orgDid,
      aud: nodeDid,
      iss: nillionConfig.orgCredentials.orgDid,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, nillionConfig.orgCredentials.secretKey, {
      algorithm: "HS256",
    });
  }

  private async makeRequest(
    nodeUrl: string,
    nodeDid: string,
    endpoint: string,
    method: string,
    body?: any
  ): Promise<any> {
    const token = this.generateNodeToken(nodeDid);

    const response = await fetch(`${nodeUrl}/api/v1${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  protected async encryptField(value: string): Promise<{ "%share": string }> {
    await this.initClusterKey();
    const encrypted = await nilql.encrypt(this.clusterKey, value);
    return { "%share": encrypted[0] }; // Use first share for this node
  }

  protected async decryptField(
    shares: { "%share": string }[]
  ): Promise<string> {
    await this.initClusterKey();
    const shareValues = shares.map((s) => s["%share"]);
    return await nilql.decrypt(this.clusterKey, shareValues);
  }

  protected generateId(): string {
    return uuidv4();
  }

  async create(data: T[]): Promise<string[]> {
    const payload = {
      schema: this.schemaId,
      data,
    };

    const results = await Promise.allSettled(
      nillionConfig.nodes.map(async (node, index) => {
        // For each node, we need to use the appropriate share
        const nodeData = await this.prepareDataForNode(data, index);
        const nodePayload = { schema: this.schemaId, data: nodeData };
        return this.makeRequest(
          node.url,
          node.did,
          "/data/create",
          "POST",
          nodePayload
        );
      })
    );

    const successful = results
      .filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === "fulfilled" && result.value.data?.created
      )
      .map((result) => result.value);

    if (successful.length === 0) {
      const errors = results
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected"
        )
        .map((result) => result.reason.message);
      throw new Error(`All nodes failed: ${errors.join(", ")}`);
    }

    return successful.flatMap((result) => result.data.created);
  }

  private async prepareDataForNode(data: T[], nodeIndex: number): Promise<T[]> {
    // This would need to be implemented based on how nilQL distributes shares
    // For now, return the data as-is since nilQL should handle distribution
    return data;
  }

  async findAll(filter: Record<string, any> = {}): Promise<T[]> {
    const payload = {
      schema: this.schemaId,
      filter,
    };

    // Get data from all nodes to reconstruct encrypted fields
    const results = await Promise.allSettled(
      nillionConfig.nodes.map((node) =>
        this.makeRequest(node.url, node.did, "/data/read", "POST", payload)
      )
    );

    const successful = results
      .filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === "fulfilled"
      )
      .map((result) => result.value.data || []);

    if (successful.length === 0) {
      throw new Error("No nodes returned data");
    }

    // Return data from first successful node
    // Note: In practice, you'd reconstruct encrypted fields from all nodes
    return successful[0];
  }

  async findById(id: string): Promise<T | null> {
    const results = await this.findAll({ _id: id });
    return results.length > 0 ? results[0] : null;
  }

  async update(id: string, data: Partial<T>): Promise<boolean> {
    const payload = {
      schema: this.schemaId,
      id,
      data,
    };

    try {
      await Promise.all(
        nillionConfig.nodes.map((node) =>
          this.makeRequest(node.url, node.did, "/data/update", "POST", payload)
        )
      );
      return true;
    } catch (error) {
      console.error("Update failed:", error);
      return false;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await Promise.all(
        nillionConfig.nodes.map((node) =>
          this.makeRequest(node.url, node.did, `/data/delete/${id}`, "DELETE")
        )
      );
      return true;
    } catch (error) {
      console.error("Delete failed:", error);
      return false;
    }
  }
}
