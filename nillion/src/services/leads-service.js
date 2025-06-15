"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadsService = void 0;
const base_service_js_1 = require("./base-service.js");
const nillion_js_1 = require("../config/nillion.js");
const uuid_1 = require("uuid");
class LeadsService extends base_service_js_1.BaseService {
    constructor() {
        super(nillion_js_1.SCHEMA_IDS.LEADS);
    }
    async createLead(name, source, description, metadata = {}) {
        const lead = {
            id: (0, uuid_1.v4)(),
            name,
            source,
            description,
            metadata,
        };
        const ids = await this.create([lead]);
        return ids[0];
    }
    async getLeadsBySource(source) {
        return await this.findAll({ source });
    }
    async searchLeads(searchTerm) {
        return await this.findAll({
            $or: [
                { name: { $regex: searchTerm, $options: "i" } },
                { description: { $regex: searchTerm, $options: "i" } },
                { source: { $regex: searchTerm, $options: "i" } },
            ],
        });
    }
    // Analytics
    async getLeadsCountBySource() {
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
    async getTopLeadSources(limit = 5) {
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
exports.LeadsService = LeadsService;
