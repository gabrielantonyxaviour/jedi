"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrantsService = void 0;
const base_service_js_1 = require("./base-service.js");
const nillion_js_1 = require("../config/nillion.js");
const uuid_1 = require("uuid");
class GrantsService extends base_service_js_1.BaseService {
    constructor() {
        super(nillion_js_1.SCHEMA_IDS.GRANTS);
    }
    async createGrantCollection(name, desc, links, image_url, owner, members, user_email, user_name) {
        const grantCollection = {
            _id: (0, uuid_1.v4)(),
            name,
            desc,
            links,
            image_url,
            owner,
            members,
            user_email: { "%allot": user_email }, // encrypted
            user_name,
            grants: [],
        };
        const ids = await this.create([grantCollection]);
        return ids[0];
    }
    async addGrant(collectionId, name, desc, milestones = []) {
        const collection = await this.findById(collectionId);
        if (!collection)
            return false;
        const newGrant = {
            id: (0, uuid_1.v4)(),
            name,
            desc,
            applied_at: Date.now(),
            milestones,
        };
        collection.grants.push(newGrant);
        return await this.update(collectionId, collection);
    }
    async addMilestone(collectionId, grantId, name, desc) {
        const collection = await this.findById(collectionId);
        if (!collection)
            return false;
        const grant = collection.grants.find((g) => g.id === grantId);
        if (!grant)
            return false;
        const milestone = {
            id: (0, uuid_1.v4)(),
            name,
            desc,
            created_at: Date.now(),
        };
        grant.milestones.push(milestone);
        return await this.update(collectionId, collection);
    }
    async getGrantsByOwner(owner) {
        return await this.findAll({ owner });
    }
    async getGrantsByMember(member) {
        return await this.findAll({ members: { $in: [member] } });
    }
    // Analytics
    async getGrantStats() {
        const pipeline = [
            {
                $project: {
                    name: 1,
                    owner: 1,
                    grantCount: { $size: "$grants" },
                    memberCount: { $size: "$members" },
                },
            },
            {
                $group: {
                    _id: null,
                    totalCollections: { $sum: 1 },
                    totalGrants: { $sum: "$grantCount" },
                    avgGrantsPerCollection: { $avg: "$grantCount" },
                    avgMembersPerCollection: { $avg: "$memberCount" },
                },
            },
        ];
        return await this.query(pipeline);
    }
    async getMilestoneProgress() {
        const pipeline = [
            {
                $unwind: "$grants",
            },
            {
                $project: {
                    grantName: "$grants.name",
                    milestoneCount: { $size: "$grants.milestones" },
                },
            },
            {
                $group: {
                    _id: "$grantName",
                    totalMilestones: { $sum: "$milestoneCount" },
                },
            },
            {
                $sort: { totalMilestones: -1 },
            },
        ];
        return await this.query(pipeline);
    }
}
exports.GrantsService = GrantsService;
