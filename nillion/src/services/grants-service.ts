import { BaseService } from "./base-service.js";
import { GrantsCollection, Grant, GrantMilestone } from "../types/index.js";
import { SCHEMA_IDS } from "../config/nillion.js";
import { v4 as uuidv4 } from "uuid";

export class GrantsService extends BaseService<GrantsCollection> {
  constructor() {
    super(SCHEMA_IDS.GRANTS);
  }

  async createGrantCollection(
    name: string,
    desc: string,
    links: string[],
    image_url: string,
    owner: string,
    members: string[],
    user_email: string,
    user_name: string
  ): Promise<string> {
    const grantCollection: GrantsCollection = {
      id: uuidv4(),
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

  async addGrant(
    collectionId: string,
    name: string,
    desc: string,
    milestones: GrantMilestone[] = []
  ): Promise<boolean> {
    const collection = await this.findById(collectionId);
    if (!collection) return false;

    const newGrant: Grant = {
      id: uuidv4(),
      name,
      desc,
      applied_at: Date.now(),
      milestones,
    };

    collection.grants.push(newGrant);
    return await this.update(collectionId, collection);
  }

  async addMilestone(
    collectionId: string,
    grantId: string,
    name: string,
    desc: string
  ): Promise<boolean> {
    const collection = await this.findById(collectionId);
    if (!collection) return false;

    const grant = collection.grants.find((g) => g.id === grantId);
    if (!grant) return false;

    const milestone: GrantMilestone = {
      id: uuidv4(),
      name,
      desc,
      created_at: Date.now(),
    };

    grant.milestones.push(milestone);
    return await this.update(collectionId, collection);
  }

  async getGrantsByOwner(owner: string): Promise<GrantsCollection[]> {
    return await this.findAll({ owner });
  }

  async getGrantsByMember(member: string): Promise<GrantsCollection[]> {
    return await this.findAll({ members: { $in: [member] } });
  }

  // Analytics
  async getGrantStats(): Promise<any[]> {
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

  async getMilestoneProgress(): Promise<any[]> {
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
