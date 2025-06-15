// src/services/github-service.ts
import { ApiBaseService } from "./api-base-service.js";
import { GithubProject } from "../types/index.js";
import { SCHEMA_IDS } from "../config/nillion.js";

export class GithubService extends ApiBaseService<GithubProject> {
  constructor() {
    super(SCHEMA_IDS.GITHUB);
  }

  async createProject(
    name: string,
    description: string,
    technical_description: string,
    repo_url: string,
    owner: string,
    collab: string,
    owner_address: string,
    metadata: string
  ): Promise<string> {
    const project: GithubProject = {
      _id: this.generateId(),
      name: await this.encryptField(name),
      description: await this.encryptField(description),
      technical_description: await this.encryptField(technical_description),
      repo_url: await this.encryptField(repo_url),
      owner: await this.encryptField(owner),
      collab: await this.encryptField(collab),
      owner_address: await this.encryptField(owner_address),
      metadata: await this.encryptField(metadata),
    };

    const ids = await this.create([project]);
    return ids[0];
  }
}
