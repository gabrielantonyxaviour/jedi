import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
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
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private sqs: SQSClient;
  private storyService: StoryProtocolService;
  private projectsTableName: string;
  private bucketName: string;
  private orchestratorQueue: string;

  constructor() {
    const spgNftContract = networkInfo.defaultSPGNFTContractAddress as Address;
    const nftContract = networkInfo.defaultNFTContractAddress as Address;

    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });

    this.storyService = new StoryProtocolService(
      client,
      spgNftContract,
      nftContract,
      uploadJSONToIPFS,
      uploadTextToIPFS,
      mintNFT
    );

    this.projectsTableName = process.env.PROJECTS_TABLE_NAME!;
    this.bucketName = process.env.PROJECT_IP_BUCKET!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
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

  async createDispute(payload: {
    projectIpId: string;
    evidence: string;
    reason: string;
  }): Promise<any> {
    console.log(`⚖️ Creating dispute for project IP: ${payload.projectIpId}`);

    return await this.disputeProjectIP({
      targetIpId: payload.projectIpId as Address,
      evidence: payload.evidence,
      targetTag: "PLAGIARISM" as DisputeTargetTag,
      bondAmount: "1",
      livenessMonths: 1,
    });
  }

  async payRoyalty(payload: {
    projectIpId: string;
    amount: string;
  }): Promise<any> {
    console.log(`💸 Paying royalty for project: ${payload.projectIpId}`);

    return await this.payProjectLicenseFee({
      projectIpId: payload.projectIpId as Address,
      amount: payload.amount,
    });
  }

  async claimAllRoyalties(payload: { projectIpId: string }): Promise<any> {
    console.log(
      `💰 Claiming all royalties for project: ${payload.projectIpId}`
    );

    return await this.claimDeveloperRoyalties({
      projectIpId: payload.projectIpId as Address,
    });
  }

  async registerGitHubProject(payload: {
    projectId: string;
    ownerId: string;
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

    console.log("🔍 IP Registration Data pushed to aws:");
    console.log({
      ipId: registration.ipId,
      regTxHash: registration.txHash,
      licenseTermsId: registration.licenseTermsIds[0].toString(),
    });

    // Update project in DynamoDB
    await this.updateProjectWithIPData(payload.projectId, {
      ipId: registration.ipId,
      regTxHash: registration.txHash,
      licenseTermsId: registration.licenseTermsIds[0].toString(),
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

    // Update project with license data
    await this.updateProjectWithLicenseData(payload.projectId, license);

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

    await this.updateProjectWithLicenseData(payload.projectId, license);

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

    await this.updateProjectWithLicenseData(payload.projectId, license);

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

    // Store dispute record in S3
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `disputes/${dispute.disputeId}.json`,
        Body: JSON.stringify({
          disputeId: dispute.disputeId,
          targetIpId: payload.targetIpId,
          txHash: dispute.txHash,
          evidence: payload.evidence,
          createdAt: new Date().toISOString(),
        }),
        ContentType: "application/json",
      })
    );

    return dispute;
  }

  async claimDeveloperRoyalties(payload: {
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
      projectIpId: payload.projectIpId,
      amount: royaltyResponse.claimedTokens?.toString() || "0",
      token: payload.currencyTokens?.[0] || ("0x0" as Address),
      txHash: royaltyResponse.txHash || "",
      type: "claim",
      status: "confirmed",
      timestamp: Date.now(),
    };

    await this.addRoyaltyTransaction(payload.projectIpId, transaction);
    return transaction;
  }

  async payProjectLicenseFee(payload: {
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
      projectIpId: payload.projectIpId,
      amount: payload.amount,
      token: payload.token || ("0x0" as Address),
      txHash: paymentResponse.txHash,
      type: "payment",
      status: "confirmed",
      timestamp: Date.now(),
    };

    await this.addRoyaltyTransaction(payload.projectIpId, transaction);
    return transaction;
  }

  async getProjectIPDetails(payload: { projectIpId: Address }): Promise<any> {
    console.log(`🔍 Fetching project IP details: ${payload.projectIpId}`);

    const details = await this.storyService.getProjectIPDetails(
      payload.projectIpId
    );

    return {
      onChainDetails: details,
      timestamp: new Date().toISOString(),
    };
  }

  private async updateProjectWithIPData(
    projectId: string,
    ipData: any
  ): Promise<void> {
    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: this.projectsTableName,
        Key: marshall({ projectId }, { removeUndefinedValues: true }),
        UpdateExpression:
          "SET ipId = :ipId, regTxHash = :regTxHash, licenseTermsId = :licenseTermsId, updatedAt = :updatedAt",
        ExpressionAttributeValues: marshall(
          {
            ":ipId": ipData.ipId,
            ":regTxHash": ipData.regTxHash,
            ":licenseTermsId": ipData.licenseTermsId,
            ":updatedAt": new Date().toISOString(),
          },
          { removeUndefinedValues: true }
        ),
      })
    );
  }
  private async updateProjectWithLicenseData(
    projectId: string,
    license: ProjectLicense
  ): Promise<void> {
    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: this.projectsTableName,
        Key: marshall({ projectId }, { removeUndefinedValues: true }),
        UpdateExpression:
          "SET licenses = list_append(if_not_exists(licenses, :empty_list), :license), updatedAt = :updatedAt",
        ExpressionAttributeValues: marshall(
          {
            ":license": [license],
            ":empty_list": [],
            ":updatedAt": new Date().toISOString(),
          },
          { removeUndefinedValues: true }
        ),
      })
    );
  }

  private async addRoyaltyTransaction(
    projectIpId: Address,
    transaction: RoyaltyTransaction
  ): Promise<void> {
    const project = await this.getProjectByIpId(projectIpId);
    if (project) {
      await this.dynamodb.send(
        new UpdateItemCommand({
          TableName: this.projectsTableName,
          Key: marshall(
            { projectId: project.projectId },
            { removeUndefinedValues: true }
          ),
          UpdateExpression:
            "SET royaltyTransactions = list_append(if_not_exists(royaltyTransactions, :empty_list), :transaction), updatedAt = :updatedAt",
          ExpressionAttributeValues: marshall(
            {
              ":transaction": [transaction],
              ":empty_list": [],
              ":updatedAt": new Date().toISOString(),
            },
            { removeUndefinedValues: true }
          ),
        })
      );
    }
  }

  private async getProjectByIpId(ipId: Address): Promise<any> {
    // This would need a GSI on ipId, or scan all projects
    // For now, return null and handle in the calling method
    return null;
  }

  private async storeProjectMetadata(
    projectId: string,
    metadata: any
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `projects/${projectId}/metadata.json`,
        Body: JSON.stringify(metadata),
        ContentType: "application/json",
      })
    );
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
