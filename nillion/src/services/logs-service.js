"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogsService = void 0;
const base_service_js_1 = require("./base-service.js");
const nillion_js_1 = require("../config/nillion.js");
const uuid_1 = require("uuid");
class LogsService extends base_service_js_1.BaseService {
    constructor() {
        super(nillion_js_1.SCHEMA_IDS.LOGS);
    }
    async createLog(projectId, agentName, text, data) {
        const logEntry = {
            _id: (0, uuid_1.v4)(),
            projectId,
            agentName,
            text,
            data,
        };
        const result = await this.create([logEntry]);
        return result[0];
    }
    async getLogsByProject(projectId) {
        return this.findAll({ projectId });
    }
    async getLogsByAgent(agentName) {
        return this.findAll({ agentName });
    }
    async getLogsByProjectAndAgent(projectId, agentName) {
        return await this.findAll({ projectId, agentName });
    }
    // Analytics queries
    async getLogsCountByAgent() {
        const pipeline = [
            {
                $group: {
                    _id: "$agentName",
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { count: -1 },
            },
        ];
        return await this.query(pipeline);
    }
    async getRecentLogsByProject(projectId, limit = 10) {
        const pipeline = [
            {
                $match: { projectId },
            },
            {
                $sort: { _created: -1 },
            },
            {
                $limit: limit,
            },
        ];
        return await this.query(pipeline);
    }
}
exports.LogsService = LogsService;
