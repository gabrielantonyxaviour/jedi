// src/services/compliance-service.ts
import { ApiBaseService } from "./api-base-service.js";
import { Compliance } from "../types/index.js";
import { SCHEMA_IDS } from "../config/nillion.js";

export class ComplianceService extends ApiBaseService<Compliance> {
  constructor() {
    super(SCHEMA_IDS.COMPLIANCE);
  }

  async createComplianceRecord(
    name: string,
    source: string,
    data: string
  ): Promise<string> {
    const compliance: Compliance = {
      _id: this.generateId(),
      name: await this.encryptField(name),
      source: await this.encryptField(source),
      data: await this.encryptField(data),
    };

    const ids = await this.create([compliance]);
    return ids[0];
  }
}
