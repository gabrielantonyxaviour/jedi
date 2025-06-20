import {
  GAP,
  Project,
  ProjectDetails,
  Grant,
  GrantDetails,
  Milestone,
  MemberOf,
} from "@show-karma/karma-gap-sdk";
import { GapIndexerClient } from "@show-karma/karma-gap-sdk/core/class";
import { ethers } from "ethers";
import { Address, Hex } from "viem";

export interface KarmaProjectData {
  title: string;
  description: string;
  imageURL?: string;
  links?: Array<{ type: string; url: string }>;
  tags?: Array<{ name: string }>;
  ownerAddress: Address;
  members?: Address[];
}

export interface KarmaGrantData {
  title: string;
  description: string;
  proposalURL?: string;
  communityUID: string;
  cycle?: string;
  season?: string;
}

export interface KarmaMilestoneData {
  title: string;
  description: string;
  endsAt: number;
  grantUID: Hex;
  projectUID: Hex;
}

// In service.ts
export interface KarmaData {
  karmaUID: string;
  status: "draft" | "active" | "completed";
  grants: Array<{
    uid: string;
    title: string;
    status: string;
    milestones: Array<{
      uid: string;
      title: string;
      status: string;
      dueDate: string;
    }>;
  }>;
  createdAt: string;
  syncedAt: string;
  opportunityNotifications?: string[]; // Track notified grant UIDs
}
export class KarmaSDKService {
  private gap: GAP;
  private wallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.gap = new GAP({
      globalSchemas: false,
      network: process.env.KARMA_NETWORK as any,
      apiClient: new GapIndexerClient("https://gapapi.karmahq.xyz"),
    });

    // Initialize wallet from environment
    this.provider = new ethers.JsonRpcProvider(process.env.TESTNET_RPC_URL);
    this.wallet = new ethers.Wallet(
      process.env.AGENT_PRIVATE_KEY!,
      this.provider
    );
  }

  async createProject(
    projectData: KarmaProjectData
  ): Promise<{ uid: string; project: Project }> {
    const project = new Project({
      data: { project: true },
      chainID: this.getChainId(),
      schema: this.gap.findSchema("Project"),
      recipient: projectData.ownerAddress,
    });

    project.details = new ProjectDetails({
      data: {
        title: projectData.title,
        description: projectData.description,
        imageURL: projectData.imageURL || "",
        links: projectData.links || [],
        tags: projectData.tags || [],
      },
      schema: this.gap.findSchema("ProjectDetails"),
      recipient: projectData.ownerAddress,
    });

    // Add members if provided
    if (projectData.members) {
      for (const memberAddress of projectData.members) {
        const member = new MemberOf({
          data: { memberOf: true },
          schema: this.gap.findSchema("MemberOf"),
          refUID: project.uid,
          recipient: memberAddress,
        });
        project.members.push(member);
      }
    }

    await project.attest(this.wallet);

    return { uid: project.uid, project };
  }

  async applyForGrant(
    grantData: KarmaGrantData,
    projectUID: Hex
  ): Promise<{ uids: Hex[]; grant: Grant; tx: Hex }> {
    const grant = new Grant({
      data: { communityUID: grantData.communityUID },
      schema: this.gap.findSchema("Grant"),
      recipient: this.wallet.address as Address,
      refUID: projectUID,
    });

    grant.details = new GrantDetails({
      data: {
        title: grantData.title,
        proposalURL: grantData.proposalURL || "",
        description: grantData.description,
        cycle: grantData.cycle,
        season: grantData.season,
      },
      schema: this.gap.findSchema("GrantDetails"),
      recipient: this.wallet.address as Address,
    });

    const project = await this.gap.fetch.projectById(projectUID);
    project.grants.push(grant);

    const { uids, tx } = await project.attest(this.wallet);

    return { uids: uids, grant, tx: tx[0].hash as `0x${string}` };
  }

  async createMilestone(
    milestoneData: KarmaMilestoneData
  ): Promise<{ uids: Hex[]; milestone: Milestone; tx: Hex }> {
    const project = await this.gap.fetch.projectById(milestoneData.projectUID);
    const grantIndex = project.grants.findIndex(
      (grant) => grant.uid === milestoneData.grantUID
    );
    const grant = project.grants.splice(grantIndex, 1)[0];

    if (!grant) {
      throw new Error("Grant not found");
    }

    const milestone = new Milestone({
      data: {
        title: milestoneData.title,
        description: milestoneData.description,
        endsAt: milestoneData.endsAt,
      },
      schema: this.gap.findSchema("Milestone"),
      recipient: this.wallet.address as Address,
      refUID: milestoneData.grantUID,
    });

    grant.milestones.push(milestone);
    project.grants.push(grant);

    const { uids, tx } = await project.attest(this.wallet);

    return { uids: uids, milestone, tx: tx[0].hash as `0x${string}` };
  }

  async updateMilestone(
    projectUID: Hex,
    grantUID: Hex,
    milestoneUID: Hex,
    updateData: {
      title: string;
      description: string;
      endsAt?: number;
    }
  ): Promise<{ uids: Hex[]; tx: Hex; update: Milestone }> {
    const project = await this.gap.fetch.projectById(projectUID);

    const grantIndex = project.grants.findIndex(
      (grant) => grant.uid === grantUID
    );
    const grant = project.grants.splice(grantIndex, 1)[0];

    if (grant) {
      const milestoneIndex = grant.milestones.findIndex(
        (milestone) => milestone.uid === milestoneUID
      );
      const oldMilestone = grant.milestones.splice(milestoneIndex, 1)[0];

      if (oldMilestone) {
        const milestone = new Milestone({
          data: {
            title: updateData.title,
            description: updateData.description,
            endsAt: updateData.endsAt || 0,
          },
          schema: this.gap.findSchema("Milestone"),
          recipient: this.wallet.address as Address,
        });

        grant.milestones.push(milestone);
        project.grants.push(grant);

        const { uids, tx } = await project.attest(this.wallet);

        return { uids, tx: tx[0].hash as `0x${string}`, update: milestone };
      } else {
        throw new Error("Milestone not found");
      }
    } else {
      throw new Error("Grant not found");
    }
  }

  async fetchProjects(): Promise<Project[]> {
    return await this.gap.fetch.projects();
  }

  async fetchProjectBySlug(slug: string): Promise<Project> {
    return await this.gap.fetch.projectBySlug(slug);
  }

  async fetchGrantOpportunities(): Promise<any[]> {
    // Fetch all communities and their available grants
    const communities = await this.gap.fetch.communities();
    const opportunities = [];

    for (const community of communities) {
      const grants = await this.gap.fetch.grantsByCommunity(community.uid);
      for (const grant of grants) {
        opportunities.push({
          communityUID: community.uid,
          communityName: community.details?.name || "Unknown",
          grantUID: grant.uid,
          grantTitle: grant.details?.title || "Untitled Grant",
          grantDescription: grant.details?.description || "",
          deadline: grant.details?.deadline,
          amount: grant.details?.amount,
          requirements: grant.details?.requirements || [],
        });
      }
    }

    return opportunities;
  }

  private getChainId(): number {
    const network = process.env.KARMA_NETWORK || "base-sepolia";
    const chainIds = {
      "base-sepolia": 84532,
    };
    return chainIds[network as keyof typeof chainIds] || 84532;
  }
}
