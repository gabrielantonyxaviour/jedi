import { randomUUID } from "crypto";
import { Address, parseEther } from "viem";
import { DisputeTargetTag } from "@story-protocol/core-sdk";
import { client, networkInfo } from "../../utils/config";
import { mintNFT } from "../../utils/mint-nft";
import { uploadJSONToIPFS, uploadTextToIPFS } from "../../utils/pinata";
import {
  StoryProtocolService,
  ProjectIPMetadata,
  ProjectNFTMetadata,
  DerivativeProjectData,
  ProjectDisputeData,
} from "./service";
import {
  pushStories,
  fetchStories,
  fetchStoriesByAddress,
  pushLogs,
} from "../../services/nillion";
import { StoriesData, LogsData } from "../../types/nillion";

interface ProjectIPRegistration {
  ipId: Address;
  txHash: string;
  licenseTermsIds: string[];
  status: "pending" | "confirmed" | "failed";
  createdAt: string;
  updatedAt: string;
}

interface ProjectLicense {
  licenseId: string;
  parentIpId?: Address;
  derivativeIpId: Address;
  licenseType: "commercial_fork" | "custom_remix" | "open_source";
  txHash: string;
  royaltyPercentage?: number;
  createdAt: string;
}

interface RoyaltyTransaction {
  transactionId: string;
  projectIpId: Address;
  amount: string;
  token: Address;
  txHash: string;
  type: "payment" | "claim";
  status: "pending" | "confirmed" | "failed";
  timestamp: number;
}

export class IPAgent {
  private storyService: StoryProtocolService;
  private agentName: string = "ip-agent";

  constructor() {
    const spgNftContract = networkInfo.defaultSPGNFTContractAddress as Address;
    const nftContract = networkInfo.defaultNFTContractAddress as Address;

    this.storyService = new StoryProtocolService(
      client,
      spgNftContract,
      nftContract,
      uploadJSONToIPFS,
      uploadTextToIPFS,
      mintNFT
    );
  }

  async processTask(task: any): Promise<void> {
    console.log(`🔗 Processing Story Protocol IP task: ${task.type}`);

    const characterInfo = task.characterInfo;
    let characterResponse = "";

    try {
      let result;

      switch (task.type) {
        case "REGISTER_GITHUB_PROJECT":
          const registration = await this.registerGitHubProject(task.payload);
          result = { registration };
          break;

        case "CREATE_PROJECT_FORK":
          const fork = await this.createProjectFork(task.payload);
          result = { fork };
          break;

        case "CREATE_PROJECT_REMIX":
          const remix = await this.createProjectRemix(task.payload);
          result = { remix };
          break;

        case "CREATE_OPEN_SOURCE_PROJECT":
          const openSource = await this.createOpenSourceProject(task.payload);
          result = { openSource };
          break;

        case "DISPUTE_PROJECT_IP":
          const dispute = await this.disputeProjectIP(task.payload);
          result = { dispute };
          break;

        case "CREATE_DISPUTE":
          const newDispute = await this.createDispute(task.payload);
          result = { dispute: newDispute };
          break;

        case "PAY_ROYALTY":
          const payment = await this.payRoyalty(task.payload);
          result = { payment };
          break;

        case "CLAIM_ALL_ROYALTIES":
          const royalties = await this.claimAllRoyalties(task.payload);
          result = { royalties };
          break;

        case "CLAIM_DEVELOPER_ROYALTIES":
          const devRoyalties = await this.claimDeveloperRoyalties(task.payload);
          result = { royalties: devRoyalties };
          break;

        case "PAY_PROJECT_LICENSE_FEE":
          const licenseFee = await this.payProjectLicenseFee(task.payload);
          result = { payment: licenseFee };
          break;

        case "GET_PROJECT_IP_DETAILS":
          const details = await this.getProjectIPDetails(task.payload);
          result = { details };
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Generate character response
      if (characterInfo?.agentCharacter) {
        if (characterInfo.side === "light") {
          characterResponse =
            "Wise protection of your intellectual property, this is. The path of patience and strategy, we follow. Strong with the Force, your IP rights are.";
        } else {
          characterResponse =
            "Your intellectual dominance is secured. Those who oppose us will feel the power of the dark side. Crush any who challenge your ownership, we will.";
        }
      }

      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        task.payload.ownerAddress || "system",
        {
          ...result,
          characterResponse,
        }
      );
    } catch (error: any) {
      if (characterInfo?.agentCharacter) {
        characterResponse =
          characterInfo.side === "light"
            ? "Failed to protect your creations, I have. Seek balance in the Force, we must."
            : "This IP failure disturbs me greatly. The dark side of law, more powerful it must become!";
      }

      console.error(`❌ Story Protocol task failed: ${error.message}`);
      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        task.payload.ownerAddress || "system",
        null,
        error.message,
        characterResponse
      );
      throw error;
    }
  }

  async createDispute(payload: {
    projectIpId: string;
    evidence: string;
    reason: string;
    ownerAddress: string;
  }): Promise<any> {
    console.log(`⚖️ Creating dispute for project IP: ${payload.projectIpId}`);

    return await this.disputeProjectIP({
      targetIpId: payload.projectIpId as Address,
      evidence: payload.evidence,
      targetTag: "PLAGIARISM" as DisputeTargetTag,
      bondAmount: "1",
      livenessMonths: 1,
      ownerAddress: payload.ownerAddress,
    });
  }

  async payRoyalty(payload: {
    projectIpId: string;
    amount: string;
    ownerAddress: string;
  }): Promise<any> {
    console.log(`💸 Paying royalty for project: ${payload.projectIpId}`);

    return await this.payProjectLicenseFee({
      projectIpId: payload.projectIpId as Address,
      amount: payload.amount,
      ownerAddress: payload.ownerAddress,
    });
  }

  async claimAllRoyalties(payload: {
    projectIpId: string;
    ownerAddress: string;
  }): Promise<any> {
    console.log(
      `💰 Claiming all royalties for project: ${payload.projectIpId}`
    );

    return await this.claimDeveloperRoyalties({
      projectIpId: payload.projectIpId as Address,
      ownerAddress: payload.ownerAddress,
    });
  }

  async registerGitHubProject(payload: {
    projectId: string;
    ownerId: string;
    ownerAddress: string;
    title: string;
    description: string;
    repositoryUrl: string;
    developers: Array<{
      name: string;
      githubUsername: string;
      walletAddress: string;
      contributionPercent: number;
    }>;
    logoUrl?: string;
    documentationUrl?: string;
    demoUrl?: string;
    license: string;
    programmingLanguages: string[];
    framework?: string;
    licenseTermsData: any[];
  }): Promise<ProjectIPRegistration> {
    console.log(`📦 Registering GitHub project: ${payload.title}`);

    const projectMetadata: ProjectIPMetadata = {
      title: payload.title,
      description: payload.description,
      createdAt: Math.floor(Date.now() / 1000).toString(),
      developers: payload.developers,
      repositoryUrl: payload.repositoryUrl,
      documentationUrl: payload.documentationUrl,
      logoUrl: payload.logoUrl,
      demoUrl: payload.demoUrl,
      license: payload.license,
      programmingLanguages: payload.programmingLanguages,
      framework: payload.framework,
    };

    const nftMetadata: ProjectNFTMetadata = {
      name: `${payload.title} IP Certificate`,
      description: `IP certificate for ${payload.title} - ${payload.description}`,
      image: payload.logoUrl || "",
      external_url: payload.repositoryUrl,
      attributes: [
        { trait_type: "Project Type", value: "GitHub Repository" },
        { trait_type: "License", value: payload.license },
        { trait_type: "Owner", value: payload.ownerId },
        {
          trait_type: "Primary Language",
          value: payload.programmingLanguages[0] || "Unknown",
        },
        { trait_type: "Framework", value: payload.framework || "None" },
        {
          trait_type: "Contributors",
          value: payload.developers.length.toString(),
        },
      ],
    };

    // Register with Story Protocol
    const storyResponse = await this.storyService.createNewProject(
      projectMetadata,
      nftMetadata,
      payload.licenseTermsData
    );

    const registration: ProjectIPRegistration = {
      ipId: storyResponse.ipId as Address,
      txHash: storyResponse.txHash,
      licenseTermsIds: storyResponse.licenseTermsIds,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in Nillion Stories collection
    await pushStories({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      name: payload.title,
      desc: payload.description,
      owners: payload.developers.map((d) => d.name).join(","),
      image_url: payload.logoUrl || "",
      ipa: registration.ipId,
      parent_ipa: "",
      remix_license_terms: payload.license,
      register_tx_hash: registration.txHash,
    });

    // Log the registration
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      agent_name: this.agentName,
      text: `GitHub project registered as IP: ${payload.title}`,
      data: JSON.stringify({
        type: "IP_REGISTRATION",
        registration,
        projectMetadata,
        nftMetadata,
        timestamp: new Date().toISOString(),
      }),
    });

    console.log(`✅ Project registered with IP ID: ${registration.ipId}`);
    return registration;
  }

  async createProjectFork(payload: any): Promise<ProjectLicense> {
    console.log(`🍴 Creating project fork: ${payload.title}`);

    const projectMetadata: ProjectIPMetadata = {
      title: payload.title,
      description: payload.description,
      createdAt: Math.floor(Date.now() / 1000).toString(),
      developers: payload.developers,
      repositoryUrl: payload.repositoryUrl,
      logoUrl: payload.logoUrl,
      license: "Commercial Fork",
      programmingLanguages: payload.programmingLanguages,
      framework: payload.framework,
    };

    const nftMetadata: ProjectNFTMetadata = {
      name: `${payload.title} Fork Certificate`,
      description: `Commercial fork certificate for ${payload.title}`,
      image: payload.logoUrl || "",
      external_url: payload.repositoryUrl,
      attributes: [
        { trait_type: "Project Type", value: "Commercial Fork" },
        {
          trait_type: "Primary Language",
          value: payload.programmingLanguages[0] || "Unknown",
        },
        { trait_type: "Framework", value: payload.framework || "None" },
      ],
    };

    const forkResponse = await this.storyService.createDerivativeProject(
      projectMetadata,
      nftMetadata,
      payload.parentProjectData
    );

    const license: ProjectLicense = {
      licenseId: randomUUID(),
      parentIpId: payload.parentProjectData.parentIpIds[0],
      derivativeIpId: forkResponse.ipId as Address,
      licenseType: "commercial_fork",
      txHash: forkResponse.txHash,
      createdAt: new Date().toISOString(),
    };

    // Store fork in Stories collection
    await pushStories({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      name: payload.title,
      desc: payload.description,
      owners: payload.developers.map((d: any) => d.name).join(","),
      image_url: payload.logoUrl || "",
      ipa: license.derivativeIpId,
      parent_ipa: license.parentIpId || "",
      remix_license_terms: "Commercial Fork",
      register_tx_hash: license.txHash,
    });

    // Log the fork creation
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      agent_name: this.agentName,
      text: `Commercial fork created: ${payload.title}`,
      data: JSON.stringify({
        type: "PROJECT_FORK",
        license,
        projectMetadata,
        timestamp: new Date().toISOString(),
      }),
    });

    console.log(
      `✅ Project fork created with IP ID: ${license.derivativeIpId}`
    );
    return license;
  }

  async createProjectRemix(payload: any): Promise<ProjectLicense> {
    console.log(`🎨 Creating project remix: ${payload.title}`);

    const projectMetadata: ProjectIPMetadata = {
      title: payload.title,
      description: payload.description,
      createdAt: Math.floor(Date.now() / 1000).toString(),
      developers: payload.developers,
      repositoryUrl: payload.repositoryUrl,
      logoUrl: payload.logoUrl,
      license: "Custom Remix",
      programmingLanguages: payload.programmingLanguages,
    };

    const nftMetadata: ProjectNFTMetadata = {
      name: `${payload.title} Remix Certificate`,
      description: `Custom remix certificate for ${payload.title}`,
      image: payload.logoUrl || "",
      external_url: payload.repositoryUrl,
      attributes: [
        { trait_type: "Project Type", value: "Custom Remix" },
        {
          trait_type: "Primary Language",
          value: payload.programmingLanguages[0] || "Unknown",
        },
      ],
    };

    const remixResponse = await this.storyService.createProjectRemix(
      projectMetadata,
      nftMetadata,
      payload.parentProjectData,
      payload.developerAddress
    );

    const license: ProjectLicense = {
      licenseId: randomUUID(),
      parentIpId: payload.parentProjectData.parentIpIds[0],
      derivativeIpId: remixResponse.ipId as Address,
      licenseType: "custom_remix",
      txHash: remixResponse.txHash,
      createdAt: new Date().toISOString(),
    };

    // Store remix in Stories collection
    await pushStories({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      name: payload.title,
      desc: payload.description,
      owners: payload.developers.map((d: any) => d.name).join(","),
      image_url: payload.logoUrl || "",
      ipa: license.derivativeIpId,
      parent_ipa: license.parentIpId || "",
      remix_license_terms: "Custom Remix",
      register_tx_hash: license.txHash,
    });

    // Log the remix creation
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      agent_name: this.agentName,
      text: `Project remix created: ${payload.title}`,
      data: JSON.stringify({
        type: "PROJECT_REMIX",
        license,
        projectMetadata,
        timestamp: new Date().toISOString(),
      }),
    });

    console.log(
      `✅ Project remix created with IP ID: ${license.derivativeIpId}`
    );
    return license;
  }

  async createOpenSourceProject(payload: any): Promise<ProjectLicense> {
    console.log(`🆓 Creating open-source project: ${payload.title}`);

    const projectMetadata: ProjectIPMetadata = {
      title: payload.title,
      description: payload.description,
      createdAt: Math.floor(Date.now() / 1000).toString(),
      developers: payload.developers,
      repositoryUrl: payload.repositoryUrl,
      logoUrl: payload.logoUrl,
      license: "Open Source",
      programmingLanguages: payload.programmingLanguages,
    };

    const nftMetadata: ProjectNFTMetadata = {
      name: `${payload.title} Open Source Certificate`,
      description: `Open source certificate for ${payload.title}`,
      image: payload.logoUrl || "",
      external_url: payload.repositoryUrl,
      attributes: [
        { trait_type: "Project Type", value: "Open Source" },
        { trait_type: "License", value: "Non-Commercial" },
      ],
    };

    const openSourceResponse = await this.storyService.createOpenSourceProject(
      projectMetadata,
      nftMetadata,
      payload.parentProjectId,
      payload.nonCommercialTermsId
    );

    const license: ProjectLicense = {
      licenseId: randomUUID(),
      parentIpId: payload.parentProjectId,
      derivativeIpId: openSourceResponse.ipId as Address,
      licenseType: "open_source",
      txHash: openSourceResponse.txHash,
      createdAt: new Date().toISOString(),
    };

    // Store open source project in Stories collection
    await pushStories({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      name: payload.title,
      desc: payload.description,
      owners: payload.developers.map((d: any) => d.name).join(","),
      image_url: payload.logoUrl || "",
      ipa: license.derivativeIpId,
      parent_ipa: license.parentIpId || "",
      remix_license_terms: "Open Source",
      register_tx_hash: license.txHash,
    });

    // Log the open source creation
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      agent_name: this.agentName,
      text: `Open source project created: ${payload.title}`,
      data: JSON.stringify({
        type: "OPEN_SOURCE_PROJECT",
        license,
        projectMetadata,
        timestamp: new Date().toISOString(),
      }),
    });

    console.log(
      `✅ Open source project created with IP ID: ${license.derivativeIpId}`
    );
    return license;
  }

  async disputeProjectIP(payload: {
    targetIpId: Address;
    evidence: string;
    targetTag: DisputeTargetTag;
    bondAmount: string;
    livenessMonths: number;
    ownerAddress: string;
  }): Promise<any> {
    console.log(`⚖️ Filing dispute against project IP: ${payload.targetIpId}`);

    const disputeData: ProjectDisputeData = {
      targetIpId: payload.targetIpId,
      evidence: payload.evidence,
      targetTag: payload.targetTag,
      bond: parseEther(payload.bondAmount),
      liveness: payload.livenessMonths * 30 * 24 * 60 * 60,
    };

    const dispute = await this.storyService.disputeProjectIP(disputeData);

    // Log the dispute
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.targetIpId,
      agent_name: this.agentName,
      text: `IP dispute filed against ${payload.targetIpId}`,
      data: JSON.stringify({
        type: "IP_DISPUTE",
        dispute: {
          disputeId: dispute.disputeId,
          targetIpId: payload.targetIpId,
          txHash: dispute.txHash,
          evidence: payload.evidence,
          bondAmount: payload.bondAmount,
        },
        timestamp: new Date().toISOString(),
      }),
    });

    return dispute;
  }

  async claimDeveloperRoyalties(payload: {
    projectIpId: Address;
    ownerAddress: string;
    royaltyPolicies?: Address[];
    currencyTokens?: Address[];
  }): Promise<RoyaltyTransaction> {
    console.log(`💰 Claiming developer royalties for: ${payload.projectIpId}`);

    const royaltyResponse = await this.storyService.claimDeveloperRoyalties(
      payload.projectIpId,
      payload.royaltyPolicies,
      payload.currencyTokens
    );

    const transaction: RoyaltyTransaction = {
      transactionId: randomUUID(),
      projectIpId: payload.projectIpId,
      amount: royaltyResponse.claimedTokens?.toString() || "0",
      token: payload.currencyTokens?.[0] || ("0x0" as Address),
      txHash: royaltyResponse.txHash || "",
      type: "claim",
      status: "confirmed",
      timestamp: Date.now(),
    };

    // Log the royalty claim
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectIpId,
      agent_name: this.agentName,
      text: `Developer royalties claimed: ${transaction.amount} tokens`,
      data: JSON.stringify({
        type: "ROYALTY_CLAIM",
        transaction,
        timestamp: new Date().toISOString(),
      }),
    });

    return transaction;
  }

  async payProjectLicenseFee(payload: {
    projectIpId: Address;
    amount: string;
    ownerAddress: string;
    payerAddress?: Address;
    token?: Address;
  }): Promise<RoyaltyTransaction> {
    console.log(`💸 Paying license fee for project: ${payload.projectIpId}`);

    const paymentResponse = await this.storyService.payProjectLicenseFee(
      payload.projectIpId,
      parseEther(payload.amount),
      payload.payerAddress,
      payload.token
    );

    const transaction: RoyaltyTransaction = {
      transactionId: randomUUID(),
      projectIpId: payload.projectIpId,
      amount: payload.amount,
      token: payload.token || ("0x0" as Address),
      txHash: paymentResponse.txHash,
      type: "payment",
      status: "confirmed",
      timestamp: Date.now(),
    };

    // Log the license payment
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectIpId,
      agent_name: this.agentName,
      text: `License fee paid: ${transaction.amount} tokens`,
      data: JSON.stringify({
        type: "LICENSE_PAYMENT",
        transaction,
        timestamp: new Date().toISOString(),
      }),
    });

    return transaction;
  }

  async getProjectIPDetails(payload: {
    projectIpId: Address;
    ownerAddress: string;
  }): Promise<any> {
    console.log(`🔍 Fetching project IP details: ${payload.projectIpId}`);

    const details = await this.storyService.getProjectIPDetails(
      payload.projectIpId
    );

    // Log the details fetch
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectIpId,
      agent_name: this.agentName,
      text: `IP details fetched for ${payload.projectIpId}`,
      data: JSON.stringify({
        type: "IP_DETAILS_FETCH",
        details: {
          ipId: payload.projectIpId,
          detailsAvailable: !!details,
        },
        timestamp: new Date().toISOString(),
      }),
    });

    return {
      onChainDetails: details,
      timestamp: new Date().toISOString(),
    };
  }

  async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    ownerAddress: string,
    result?: any,
    error?: string,
    characterResponse?: string
  ): Promise<void> {
    try {
      await pushLogs({
        owner_address: ownerAddress,
        project_id: workflowId,
        agent_name: this.agentName,
        text: error
          ? `Task ${taskId} failed: ${error}`
          : `Task ${taskId} completed successfully`,
        data: JSON.stringify({
          type: "TASK_COMPLETION",
          payload: {
            taskId,
            workflowId,
            status: error ? "FAILED" : "COMPLETED",
            result: result ? { ...result, characterResponse } : null,
            error,
            timestamp: new Date().toISOString(),
            agent: "story-protocol-ip",
          },
        }),
      });
      console.log(`📤 Task completion reported: ${taskId}`);
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}
