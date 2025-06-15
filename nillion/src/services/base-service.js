"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseService = void 0;
const secretvaults_1 = require("secretvaults");
const nillion_js_1 = require("../config/nillion.js");
const uuid_1 = require("uuid");
class BaseService {
    constructor(schemaId) {
        this.schemaId = schemaId;
        this.initialized = false;
        this.collection = new secretvaults_1.SecretVaultWrapper(nillion_js_1.nillionConfig.nodes, nillion_js_1.nillionConfig.orgCredentials, schemaId);
    }
    async init() {
        if (!this.initialized) {
            await this.collection.init();
            this.initialized = true;
        }
    }
    encryptField(value) {
        return { "%share": value };
    }
    generateId() {
        return (0, uuid_1.v4)();
    }
    async create(data) {
        await this.init();
        const result = await this.collection.writeToNodes(data);
        const successful = result.filter((item) => { var _a; return (_a = item.data) === null || _a === void 0 ? void 0 : _a.created; });
        const failed = result.filter((item) => { var _a; return !((_a = item.data) === null || _a === void 0 ? void 0 : _a.created); });
        if (successful.length === 0) {
            throw new Error(`All nodes failed: ${failed
                .map((f) => f.error || f.status)
                .join(", ")}`);
        }
        if (failed.length > 0 && failed.length < result.length) {
            console.warn(`⚠️ ${failed.length}/${result.length} nodes failed, but operation succeeded`);
        }
        return successful.flatMap((item) => item.data.created);
    }
    async findAll(filter = {}) {
        await this.init();
        try {
            return await this.collection.readFromNodes(filter);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes("401")) {
                console.warn("⚠️ Some nodes failed auth, but data may still be available");
                return [];
            }
            throw error;
        }
    }
    async findById(id) {
        await this.init();
        const results = await this.collection.readFromNodes({ _id: id });
        return results.length > 0 ? results[0] : null;
    }
    async update(id, data) {
        await this.init();
        try {
            await this.collection.updateFromNodes(id, data);
            return true;
        }
        catch (error) {
            console.error(`Update failed:`, error);
            return false;
        }
    }
    async delete(id) {
        await this.init();
        try {
            await this.collection.deleteFromNodes(id);
            return true;
        }
        catch (error) {
            console.error(`Delete failed:`, error);
            return false;
        }
    }
    async query(pipeline, variables) {
        await this.init();
        throw new Error("Query functionality not yet implemented in secretvaults wrapper");
    }
}
exports.BaseService = BaseService;
