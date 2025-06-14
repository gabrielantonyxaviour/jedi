import { BaseService } from "./base-service.js";
import { Story } from "../types/index.js";
import { SCHEMA_IDS } from "../config/nillion.js";
import { v4 as uuidv4 } from "uuid";

export class StoriesService extends BaseService<Story> {
  constructor() {
    super(SCHEMA_IDS.STORIES);
  }

  async createStory(
    name: string,
    desc: string,
    owners: string[],
    image_url: string,
    ipa: string,
    parent_ipa: string,
    remix_license_terms: "commercial" | "non-commercial",
    register_tx_hash: string
  ): Promise<string> {
    const story: Story = {
      id: uuidv4(),
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

  async getStoriesByOwner(owner: string): Promise<Story[]> {
    return await this.findAll({ owners: { $in: [owner] } });
  }

  async getStoriesByLicense(
    license: "commercial" | "non-commercial"
  ): Promise<Story[]> {
    return await this.findAll({ remix_license_terms: license });
  }

  async getStoriesByParentIpa(parentIpa: string): Promise<Story[]> {
    return await this.findAll({ parent_ipa: parentIpa });
  }

  // Analytics
  async getLicenseDistribution(): Promise<any[]> {
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

  async getOwnershipStats(): Promise<any[]> {
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

  async getRemixHierarchy(): Promise<any[]> {
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
