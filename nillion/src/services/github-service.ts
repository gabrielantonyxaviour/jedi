import { BaseService } from "./base-service";
import { GithubProject } from "../types";
import { SCHEMA_IDS } from "../config/nillion";
import { v4 as uuidv4 } from "uuid";

export class GithubService extends BaseService<GithubProject> {
  constructor() {
    super(SCHEMA_IDS.GITHUB);
  }

  async createProject(
    name: string,
    description: string,
    technical_description: string,
    repo_url: string,
    owner: string,
    collab: string[] = [],
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const project: GithubProject = {
      id: uuidv4(),
      name,
      description,
      technical_description,
      repo_url,
      owner,
      collab,
      metadata,
    };

    const ids = await this.create([project]);
    return ids[0];
  }

  async getProjectsByOwner(owner: string): Promise<GithubProject[]> {
    return await this.findAll({ owner });
  }

  async getProjectsByCollaborator(
    collaborator: string
  ): Promise<GithubProject[]> {
    return await this.findAll({ collab: { $in: [collaborator] } });
  }

  async searchProjects(searchTerm: string): Promise<GithubProject[]> {
    return await this.findAll({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
        { technical_description: { $regex: searchTerm, $options: "i" } },
      ],
    });
  }

  // Analytics
  async getProjectsCountByOwner(): Promise<any[]> {
    const pipeline = [
      {
        $group: {
          _id: "$owner",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ];

    return await this.query(pipeline);
  }

  async getCollaborationStats(): Promise<any[]> {
    const pipeline = [
      {
        $project: {
          name: 1,
          owner: 1,
          collabCount: { $size: "$collab" },
        },
      },
      {
        $group: {
          _id: null,
          avgCollaborators: { $avg: "$collabCount" },
          maxCollaborators: { $max: "$collabCount" },
          totalProjects: { $sum: 1 },
        },
      },
    ];

    return await this.query(pipeline);
  }
}
