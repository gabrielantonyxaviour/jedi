"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoriesService = void 0;
const base_service_js_1 = require("./base-service.js");
const nillion_js_1 = require("../config/nillion.js");
const uuid_1 = require("uuid");
class StoriesService extends base_service_js_1.BaseService {
    constructor() {
        super(nillion_js_1.SCHEMA_IDS.STORIES);
    }
    async createStory(name, desc, owners, image_url, ipa, parent_ipa, remix_license_terms, register_tx_hash) {
        const story = {
            id: (0, uuid_1.v4)(),
            name,
            desc,
            owners,
            image_url,
            ipa,
            parent_ipa,
            remix_license_terms,
            register_tx_hash,
        };
        const ids = await this.create([story]);
        return ids[0];
    }
    async getStoriesByOwner(owner) {
        return await this.findAll({ owners: { $in: [owner] } });
    }
    async getStoriesByLicense(license) {
        return await this.findAll({ remix_license_terms: license });
    }
    async getStoriesByParentIpa(parentIpa) {
        return await this.findAll({ parent_ipa: parentIpa });
    }
    // Analytics
    async getLicenseDistribution() {
        const pipeline = [
            {
                $group: {
                    _id: "$remix_license_terms",
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { count: -1 },
            },
        ];
        return await this.query(pipeline);
    }
    async getOwnershipStats() {
        const pipeline = [
            {
                $project: {
                    name: 1,
                    ownerCount: { $size: "$owners" },
                },
            },
            {
                $group: {
                    _id: null,
                    avgOwners: { $avg: "$ownerCount" },
                    maxOwners: { $max: "$ownerCount" },
                    totalStories: { $sum: 1 },
                },
            },
        ];
        return await this.query(pipeline);
    }
    async getRemixHierarchy() {
        const pipeline = [
            {
                $group: {
                    _id: "$parent_ipa",
                    remixes: { $push: { name: "$name", ipa: "$ipa" } },
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
exports.StoriesService = StoriesService;
