import { BaseService } from "./base-service.js";
import { Compliance } from "../types/index.js";
import { SCHEMA_IDS } from "../config/nillion.js";
import { v4 as uuidv4 } from "uuid";

export class ComplianceService extends BaseService<Compliance> {
  constructor() {
    super(SCHEMA_IDS.COMPLIANCE);
  }

  async createComplianceRecord(
    name: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const compliance: Compliance = {
      id: uuidv4(),
      name,
      metadata,
    };

    const ids = await this.create([compliance]);
    return ids[0];
  }

  async searchCompliance(searchTerm: string): Promise<Compliance[]> {
    return await this.findAll({
      name: { $regex: searchTerm, $options: "i" },
    });
  }

  // Analytics
  async getComplianceRecordCount(): Promise<any[]> {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
        },
      },
    ];

    return await this.query(pipeline);
  }

  async getMetadataKeyFrequency(): Promise<any[]> {
    const pipeline = [
      {
        $project: {
          metadataKeys: { $objectToArray: "$metadata" },
        },
      },
      {
        $unwind: "$metadataKeys",
      },
      {
        $group: {
          _id: "$metadataKeys.k",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ];

    return await this.query(pipeline);
  }
}
