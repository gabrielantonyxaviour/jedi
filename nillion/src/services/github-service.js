"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubService = void 0;
// src/services/github-service.ts
const api_base_service_js_1 = require("./api-base-service.js");
const nillion_js_1 = require("../config/nillion.js");
class GithubService extends api_base_service_js_1.ApiBaseService {
    constructor() {
        super(nillion_js_1.SCHEMA_IDS.GITHUB);
    }
    async createProject(name, description, technical_description, repo_url, owner, collab, owner_address, metadata) {
        const project = {
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
exports.GithubService = GithubService;
