// src/karma-service.ts
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

export class KarmaService {
  private gap: GAP;
  private wallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.gap = new GAP({
      globalSchemas: false,
      network: "optimism-sepolia",
      apiClient: new GapIndexerClient("https://gapapi.karmahq.xyz"),
    });

    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new ethers.Wallet(
      process.env.AGENT_PRIVATE_KEY!,
      this.provider
    );
  }

  async createProject(projectData: KarmaProjectData) {
    console.log(`🚀 Creating project: ${projectData.title}`);

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

    const result = await project.attest(this.wallet);
    console.log(`✅ Project created with UID: ${project.uid}`);
    return { uid: project.uid, project, result };
  }

  async applyForGrant(grantData: KarmaGrantData, projectUID: Hex) {
    console.log(`📝 Applying for grant: ${grantData.title}`);

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
    console.log(`✅ Grant application submitted with UIDs: ${uids.join(", ")}`);
    return { uids, grant, tx: tx[0].hash as `0x${string}` };
  }

  async createMilestone(milestoneData: KarmaMilestoneData) {
    console.log(`📋 Creating milestone: ${milestoneData.title}`);

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
    console.log(`✅ Milestone created with UIDs: ${uids.join(", ")}`);
    return { uids, milestone, tx: tx[0].hash as `0x${string}` };
  }

  async updateMilestone(
    projectUID: Hex,
    grantUID: Hex,
    milestoneUID: Hex,
    updateData: { title: string; description: string; endsAt?: number }
  ) {
    console.log(`✏️ Updating milestone: ${updateData.title}`);

    const project = await this.gap.fetch.projectById(projectUID);
    const grantIndex = project.grants.findIndex(
      (grant) => grant.uid === grantUID
    );
    const grant = project.grants.splice(grantIndex, 1)[0];

    if (!grant) throw new Error("Grant not found");

    const milestoneIndex = grant.milestones.findIndex(
      (milestone) => milestone.uid === milestoneUID
    );
    const oldMilestone = grant.milestones.splice(milestoneIndex, 1)[0];

    if (!oldMilestone) throw new Error("Milestone not found");

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
    console.log(`✅ Milestone updated with UIDs: ${uids.join(", ")}`);
    return { uids, tx: tx[0].hash as `0x${string}`, update: milestone };
  }

  async fetchProjects() {
    console.log("📋 Fetching all projects...");
    const projects = await this.gap.fetch.projects();
    console.log(`Found ${projects.length} projects`);
    return projects;
  }

  async fetchProjectBySlug(slug: string) {
    console.log(`🔍 Fetching project by slug: ${slug}`);
    return await this.gap.fetch.projectBySlug(slug);
  }

  async fetchProjectById(uid: Hex) {
    console.log(`🔍 Fetching project by ID: ${uid}`);
    return await this.gap.fetch.projectById(uid);
  }

  async fetchGrantOpportunities() {
    console.log("🎯 Fetching grant opportunities...");
    const communities = await this.gap.fetch.communities();
    const opportunities: any[] = [];

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

    console.log(`Found ${opportunities.length} grant opportunities`);
    return opportunities;
  }

  async fetchCommunities() {
    console.log("🏘️ Fetching communities...");
    const communities = await this.gap.fetch.communities();
    console.log(`Found ${communities.length} communities`);
    return communities;
  }

  private getChainId(): number {
    const network = process.env.KARMA_NETWORK || "optimism";
    const chainIds = {
      optimism: 10,
      "optimism-sepolia": 11155420,
      ethereum: 1,
      sepolia: 11155111,
      celo: 42220,
    };
    return chainIds[network as keyof typeof chainIds] || 10;
  }

  getWalletAddress() {
    return this.wallet.address;
  }
}
