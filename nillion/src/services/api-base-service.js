"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiBaseService = void 0;
// src/services/api-base-service.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const nilql_1 = require("@nillion/nilql");
const nillion_js_1 = require("../config/nillion.js");
const uuid_1 = require("uuid");
class ApiBaseService {
    constructor(schemaId) {
        this.schemaId = schemaId;
        this.clusterKey = null;
    }
    async initClusterKey() {
        if (!this.clusterKey) {
            const cluster = {
                nodes: nillion_js_1.nillionConfig.nodes.map((node) => ({
                    url: node.url,
                    did: node.did,
                })),
            };
            this.clusterKey = await nilql_1.nilql.ClusterKey.generate(cluster, {
                store: true,
                match: true,
                sum: true,
            });
        }
    }
    generateNodeToken(nodeDid) {
        const payload = {
            sub: nillion_js_1.nillionConfig.orgCredentials.orgDid,
            aud: nodeDid,
            iss: nillion_js_1.nillionConfig.orgCredentials.orgDid,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
        };
        return jsonwebtoken_1.default.sign(payload, nillion_js_1.nillionConfig.orgCredentials.secretKey, {
            algorithm: "HS256",
        });
    }
    async makeRequest(nodeUrl, nodeDid, endpoint, method, body) {
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
    async encryptField(value) {
        await this.initClusterKey();
        const encrypted = await nilql_1.nilql.encrypt(this.clusterKey, value);
        return { "%share": encrypted[0] }; // Use first share for this node
    }
    async decryptField(shares) {
        await this.initClusterKey();
        const shareValues = shares.map((s) => s["%share"]);
        return await nilql_1.nilql.decrypt(this.clusterKey, shareValues);
    }
    generateId() {
        return (0, uuid_1.v4)();
    }
    async create(data) {
        const payload = {
            schema: this.schemaId,
            data,
        };
        const results = await Promise.allSettled(nillion_js_1.nillionConfig.nodes.map(async (node, index) => {
            // For each node, we need to use the appropriate share
            const nodeData = await this.prepareDataForNode(data, index);
            const nodePayload = { schema: this.schemaId, data: nodeData };
            return this.makeRequest(node.url, node.did, "/data/create", "POST", nodePayload);
        }));
        const successful = results
            .filter((result) => { var _a; return result.status === "fulfilled" && ((_a = result.value.data) === null || _a === void 0 ? void 0 : _a.created); })
            .map((result) => result.value);
        if (successful.length === 0) {
            const errors = results
                .filter((result) => result.status === "rejected")
                .map((result) => result.reason.message);
            throw new Error(`All nodes failed: ${errors.join(", ")}`);
        }
        return successful.flatMap((result) => result.data.created);
    }
    async prepareDataForNode(data, nodeIndex) {
        // This would need to be implemented based on how nilQL distributes shares
        // For now, return the data as-is since nilQL should handle distribution
        return data;
    }
    async findAll(filter = {}) {
        const payload = {
            schema: this.schemaId,
            filter,
        };
        // Get data from all nodes to reconstruct encrypted fields
        const results = await Promise.allSettled(nillion_js_1.nillionConfig.nodes.map((node) => this.makeRequest(node.url, node.did, "/data/read", "POST", payload)));
        const successful = results
            .filter((result) => result.status === "fulfilled")
            .map((result) => result.value.data || []);
        if (successful.length === 0) {
            throw new Error("No nodes returned data");
        }
        // Return data from first successful node
        // Note: In practice, you'd reconstruct encrypted fields from all nodes
        return successful[0];
    }
    async findById(id) {
        const results = await this.findAll({ _id: id });
        return results.length > 0 ? results[0] : null;
    }
    async update(id, data) {
        const payload = {
            schema: this.schemaId,
            id,
            data,
        };
        try {
            await Promise.all(nillion_js_1.nillionConfig.nodes.map((node) => this.makeRequest(node.url, node.did, "/data/update", "POST", payload)));
            return true;
        }
        catch (error) {
            console.error("Update failed:", error);
            return false;
        }
    }
    async delete(id) {
        try {
            await Promise.all(nillion_js_1.nillionConfig.nodes.map((node) => this.makeRequest(node.url, node.did, `/data/delete/${id}`, "DELETE")));
            return true;
        }
        catch (error) {
            console.error("Delete failed:", error);
            return false;
        }
    }
}
exports.ApiBaseService = ApiBaseService;
