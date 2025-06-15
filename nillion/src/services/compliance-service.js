"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceService = void 0;
// src/services/compliance-service.ts
const api_base_service_js_1 = require("./api-base-service.js");
const nillion_js_1 = require("../config/nillion.js");
class ComplianceService extends api_base_service_js_1.ApiBaseService {
    constructor() {
        super(nillion_js_1.SCHEMA_IDS.COMPLIANCE);
    }
    async createComplianceRecord(name, source, data) {
        const compliance = {
            _id: this.generateId(),
            name: await this.encryptField(name),
            source: await this.encryptField(source),
            data: await this.encryptField(data),
        };
        const ids = await this.create([compliance]);
        return ids[0];
    }
}
exports.ComplianceService = ComplianceService;
