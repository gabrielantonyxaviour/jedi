import { BaseService } from "./base-service.js";
import { Lead } from "../types/index.js";
import { SCHEMA_IDS } from "../config/nillion.js";
import { v4 as uuidv4 } from "uuid";

export class LeadsService extends BaseService<Lead> {
  constructor() {
    super(SCHEMA_IDS.LEADS);
  }

  async createLead(
    name: string,
    source: string,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const lead: Lead = {
      id: uuidv4(),
      name,
      source,
      description,
      metadata,
    };

    const ids = await this.create([lead]);
    return ids[0];
  }

  async getLeadsBySource(source: string): Promise<Lead[]> {
    return await this.findAll({ source });
  }

  async searchLeads(searchTerm: string): Promise<Lead[]> {
    return await this.findAll({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
        { source: { $regex: searchTerm, $options: "i" } },
      ],
    });
  }

  // Analytics
  async getLeadsCountBySource(): Promise<any[]> {
    const pipeline = [
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ];

    return await this.query(pipeline);
  }

  async getTopLeadSources(limit: number = 5): Promise<any[]> {
    const pipeline = [
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
          leads: { $push: "$name" },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: limit,
      },
    ];

    return await this.query(pipeline);
  }
}
