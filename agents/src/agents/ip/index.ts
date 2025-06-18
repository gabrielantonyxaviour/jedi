import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { Address, parseEther } from "viem";
import { DisputeTargetTag } from "@story-protocol/core-sdk";
import { ProjectService } from "../../services/project";
import {
  StoryProtocolService,
  ProjectIPMetadata,
  ProjectNFTMetadata,
  DerivativeProjectData,
  ProjectDisputeData,
} from "./service";

interface ProjectIPRegistration {
  registrationId: string;
  ipId: Address;
  txHash: string;
  title: string;
  repositoryUrl: string;
  developers: Array<{
    name: string;
    githubUsername: string;
    walletAddress: string;
    contributionPercent: number;
  }>;
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
  amount: string;
  token: Address;
  txHash: string;
  type: "payment" | "claim";
  status: "pending" | "confirmed" | "failed";
  timestamp: number;
}

export class IPAgent {
  private dynamodb: DynamoDBClient;
  private sqs: SQSClient;
  private storyService: StoryProtocolService;
  private projectService: ProjectService;
  private orchestratorQueue: string;

  constructor(
    storyClient: any,
    spgNftContract: Address,
    nftContract: Address,
    uploadJSONToIPFS: (data: any) => Promise<string>,
    uploadTextToIPFS: (text: string) => Promise<string>,
    mintNFT?: (address: Address, uri: string) => Promise<number | undefined>
  ) {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.projectService = new ProjectService(this.dynamodb);
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;

    // Initialize StoryProtocolService with all required parameters
    this.storyService = new StoryProtocolService(
      storyClient,
      spgNftContract,
      nftContract,
      uploadJSONToIPFS,
      uploadTextToIPFS,
      mintNFT
    );
  }

  async processTask(task: any): Promise<void> {
    console.log(`🔗 Processing Story Protocol IP task: ${task.type}`);

    const characterInfo = task.payload.characterInfo || task.characterInfo;
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

        case "GET_PROJECT_LICENSE_TERMS":
          const terms = await this.getProjectLicenseTerms(task.payload);
          result = { terms };
          break;

        case "CLAIM_PARENT_PROJECT_ROYALTIES":
          const parentRoyalties = await this.claimParentProjectRoyalties(
            task.payload
          );
          result = { royalties: parentRoyalties };
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

      await this.reportTaskCompletion(task.taskId, task.workflowId, {
        ...result,
        characterResponse,
      });
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
        null,
        error.message,
        characterResponse
      );
      throw error;
    }
  }

  async registerGitHubProject(payload: {
    projectId: string;
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
    characterName?: string;
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
        {
          trait_type: "Primary Language",
          value: payload.programmingLanguages[0] || "Unknown",
        },
        { trait_type: "Framework", value: payload.framework || "None" },
        {
          trait_type: "Contributors",
          value: payload.developers.length.toString(),
        },
        {
          trait_type: "Character Agent",
          value: payload.characterName || "Unknown",
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
      registrationId: randomUUID(),
      ipId: storyResponse.ipId as Address,
      txHash: storyResponse.txHash,
      title: payload.title,
      repositoryUrl: payload.repositoryUrl,
      developers: payload.developers,
      licenseTermsIds: storyResponse.licenseTermsIds,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update project with IP registration data
    const project = await this.projectService.getProject(payload.projectId);
    if (project) {
      const updatedIpData = {
        ...project.ip,
        isSetup: true,
        registrationId: registration.registrationId,
        ipId: registration.ipId,
        txHash: registration.txHash,
        licenseTermsIds: registration.licenseTermsIds,
        ipMetadataHash: storyResponse.ipMetadataHash,
        nftMetadataHash: storyResponse.nftMetadataHash,
        repositoryUrl: storyResponse.repositoryUrl,
        setupAt: new Date().toISOString(),
        licenses: project.ip?.licenses || [],
        disputes: project.ip?.disputes || [],
        royalties: project.ip?.royalties || [],
      };

      await this.projectService.updateProjectData(
        payload.projectId,
        "ip",
        updatedIpData
      );
    }

    console.log(`✅ Project registered with IP ID: ${registration.ipId}`);
    return registration;
  }

  async createProjectFork(payload: {
    projectId: string;
    title: string;
    description: string;
    repositoryUrl: string;
    developers: Array<{
      name: string;
      githubUsername: string;
      walletAddress: string;
      contributionPercent: number;
    }>;
    parentProjectData: DerivativeProjectData;
    logoUrl?: string;
    programmingLanguages: string[];
    framework?: string;
    characterName?: string;
  }): Promise<ProjectLicense> {
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
        {
          trait_type: "Character Agent",
          value: payload.characterName || "Unknown",
        },
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

    // Add license to project
    const project = await this.projectService.getProject(payload.projectId);
    if (project?.ip) {
      const updatedIpData = {
        ...project.ip,
        licenses: [...(project.ip.licenses || []), license],
      };
      await this.projectService.updateProjectData(
        payload.projectId,
        "ip",
        updatedIpData
      );
    }

    console.log(
      `✅ Project fork created with IP ID: ${license.derivativeIpId}`
    );
    return license;
  }

  async createProjectRemix(payload: {
    projectId: string;
    title: string;
    description: string;
    repositoryUrl: string;
    developers: Array<{
      name: string;
      githubUsername: string;
      walletAddress: string;
      contributionPercent: number;
    }>;
    parentProjectData: DerivativeProjectData;
    developerAddress: Address;
    logoUrl?: string;
    programmingLanguages: string[];
    framework?: string;
    characterName?: string;
  }): Promise<ProjectLicense> {
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
      framework: payload.framework,
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
        { trait_type: "Framework", value: payload.framework || "None" },
        {
          trait_type: "Character Agent",
          value: payload.characterName || "Unknown",
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

    // Add license to project
    const project = await this.projectService.getProject(payload.projectId);
    if (project?.ip) {
      const updatedIpData = {
        ...project.ip,
        licenses: [...(project.ip.licenses || []), license],
      };
      await this.projectService.updateProjectData(
        payload.projectId,
        "ip",
        updatedIpData
      );
    }

    console.log(
      `✅ Project remix created with IP ID: ${license.derivativeIpId}`
    );
    return license;
  }

  async createOpenSourceProject(payload: {
    projectId: string;
    title: string;
    description: string;
    repositoryUrl: string;
    developers: Array<{
      name: string;
      githubUsername: string;
      walletAddress: string;
      contributionPercent: number;
    }>;
    parentProjectId: Address;
    nonCommercialTermsId: string;
    logoUrl?: string;
    programmingLanguages: string[];
    framework?: string;
    characterName?: string;
  }): Promise<ProjectLicense> {
    console.log(`🆓 Creating open source project: ${payload.title}`);

    const projectMetadata: ProjectIPMetadata = {
      title: payload.title,
      description: payload.description,
      createdAt: Math.floor(Date.now() / 1000).toString(),
      developers: payload.developers,
      repositoryUrl: payload.repositoryUrl,
      logoUrl: payload.logoUrl,
      license: "Open Source",
      programmingLanguages: payload.programmingLanguages,
      framework: payload.framework,
    };

    const nftMetadata: ProjectNFTMetadata = {
      name: `${payload.title} Open Source Certificate`,
      description: `Open source certificate for ${payload.title}`,
      image: payload.logoUrl || "",
      external_url: payload.repositoryUrl,
      attributes: [
        { trait_type: "Project Type", value: "Open Source" },
        { trait_type: "License", value: "Non-commercial" },
        {
          trait_type: "Primary Language",
          value: payload.programmingLanguages[0] || "Unknown",
        },
        { trait_type: "Framework", value: payload.framework || "None" },
        {
          trait_type: "Character Agent",
          value: payload.characterName || "Unknown",
        },
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

    // Add license to project
    const project = await this.projectService.getProject(payload.projectId);
    if (project?.ip) {
      const updatedIpData = {
        ...project.ip,
        licenses: [...(project.ip.licenses || []), license],
      };
      await this.projectService.updateProjectData(
        payload.projectId,
        "ip",
        updatedIpData
      );
    }

    console.log(
      `✅ Open source project created with IP ID: ${license.derivativeIpId}`
    );
    return license;
  }

  async disputeProjectIP(payload: {
    projectId: string;
    targetIpId: Address;
    evidence: string;
    targetTag: DisputeTargetTag;
    bondAmount: string;
    livenessMonths: number;
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

    // Store dispute in project
    const disputeRecord = {
      disputeId: dispute.disputeId,
      targetIpId: payload.targetIpId,
      evidence: payload.evidence,
      targetTag: payload.targetTag,
      bondAmount: payload.bondAmount,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const project = await this.projectService.getProject(payload.projectId);
    if (project?.ip) {
      const updatedIpData = {
        ...project.ip,
        disputes: [...(project.ip.disputes || []), disputeRecord],
      };
      await this.projectService.updateProjectData(
        payload.projectId,
        "ip",
        updatedIpData
      );
    }

    return dispute;
  }

  async createDispute(payload: {
    projectId: string;
    targetIpId: string;
    evidence: string;
    reason: string;
  }): Promise<any> {
    console.log(`⚖️ Creating dispute for project IP: ${payload.targetIpId}`);

    const result = await this.disputeProjectIP({
      projectId: payload.projectId,
      targetIpId: payload.targetIpId as Address,
      evidence: payload.evidence,
      targetTag: "PLAGIARISM" as DisputeTargetTag,
      bondAmount: "1",
      livenessMonths: 1,
    });

    return result;
  }

  async payRoyalty(payload: {
    projectId: string;
    amount: string;
  }): Promise<any> {
    console.log(`💸 Paying royalty for project: ${payload.projectId}`);

    const project = await this.projectService.getProject(payload.projectId);
    if (!project?.ip?.ipId) {
      throw new Error("Project IP not found");
    }

    return await this.payProjectLicenseFee({
      projectId: payload.projectId,
      projectIpId: project.ip.ipId as Address,
      amount: payload.amount,
    });
  }

  async claimAllRoyalties(payload: { projectId: string }): Promise<any> {
    console.log(`💰 Claiming all royalties for project: ${payload.projectId}`);

    const project = await this.projectService.getProject(payload.projectId);
    if (!project?.ip?.ipId) {
      throw new Error("Project IP not found");
    }

    return await this.claimDeveloperRoyalties({
      projectId: payload.projectId,
      projectIpId: project.ip.ipId as Address,
    });
  }

  async claimDeveloperRoyalties(payload: {
    projectId: string;
    projectIpId: Address;
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
      amount: royaltyResponse.claimedTokens?.toString() || "0",
      token: payload.currencyTokens?.[0] || ("0x0" as Address),
      txHash: royaltyResponse.txHash || "",
      type: "claim",
      status: "confirmed",
      timestamp: Date.now(),
    };

    // Store royalty transaction in project
    const project = await this.projectService.getProject(payload.projectId);
    if (project?.ip) {
      const updatedIpData = {
        ...project.ip,
        royalties: [...(project.ip.royalties || []), transaction],
      };
      await this.projectService.updateProjectData(
        payload.projectId,
        "ip",
        updatedIpData
      );
    }

    return transaction;
  }

  async payProjectLicenseFee(payload: {
    projectId: string;
    projectIpId: Address;
    amount: string;
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
      amount: payload.amount,
      token: payload.token || ("0x0" as Address),
      txHash: paymentResponse.txHash,
      type: "payment",
      status: "confirmed",
      timestamp: Date.now(),
    };

    // Store payment in project
    const project = await this.projectService.getProject(payload.projectId);
    if (project?.ip) {
      const updatedIpData = {
        ...project.ip,
        royalties: [...(project.ip.royalties || []), transaction],
      };
      await this.projectService.updateProjectData(
        payload.projectId,
        "ip",
        updatedIpData
      );
    }

    return transaction;
  }

  async claimParentProjectRoyalties(payload: {
    projectId: string;
    parentProjectId: Address;
    forkProjectIds: Address[];
    royaltyPolicies: Address[];
    currencyTokens?: Address[];
  }): Promise<RoyaltyTransaction> {
    console.log(
      `💰 Claiming parent project royalties for: ${payload.parentProjectId}`
    );

    const royaltyResponse = await this.storyService.claimParentProjectRoyalties(
      payload.parentProjectId,
      payload.forkProjectIds,
      payload.royaltyPolicies,
      payload.currencyTokens
    );

    const transaction: RoyaltyTransaction = {
      transactionId: randomUUID(),
      amount: royaltyResponse.claimedTokens?.toString() || "0",
      token: payload.currencyTokens?.[0] || ("0x0" as Address),
      txHash: royaltyResponse.txHash || "",
      type: "claim",
      status: "confirmed",
      timestamp: Date.now(),
    };

    // Store royalty transaction in project
    const project = await this.projectService.getProject(payload.projectId);
    if (project?.ip) {
      const updatedIpData = {
        ...project.ip,
        royalties: [...(project.ip.royalties || []), transaction],
      };
      await this.projectService.updateProjectData(
        payload.projectId,
        "ip",
        updatedIpData
      );
    }

    return transaction;
  }

  async getProjectIPDetails(payload: { projectId: string }): Promise<any> {
    console.log(`🔍 Fetching project IP details: ${payload.projectId}`);

    const project = await this.projectService.getProject(payload.projectId);
    if (!project?.ip?.ipId) {
      throw new Error("Project IP not found");
    }

    const details = await this.storyService.getProjectIPDetails(
      project.ip.ipId as Address
    );

    return {
      onChainDetails: details,
      projectData: project.ip,
      timestamp: new Date().toISOString(),
    };
  }

  async getProjectLicenseTerms(payload: {
    projectId: string;
    licenseTermsId?: string;
  }): Promise<any> {
    console.log(`📄 Fetching project license terms: ${payload.projectId}`);

    const project = await this.projectService.getProject(payload.projectId);
    if (!project?.ip?.licenseTermsIds?.length) {
      throw new Error("Project license terms not found");
    }

    const licenseTermsId =
      payload.licenseTermsId || project.ip.licenseTermsIds[0];
    const terms = await this.storyService.getProjectLicenseTerms(
      licenseTermsId
    );

    return {
      licenseTerms: terms,
      projectData: project.ip,
      timestamp: new Date().toISOString(),
    };
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string,
    characterResponse?: string
  ) {
    try {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: this.orchestratorQueue,
          MessageBody: JSON.stringify({
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
        })
      );
      console.log(`📤 Task completion reported: ${taskId}`);
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}
