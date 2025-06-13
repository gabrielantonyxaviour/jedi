import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";
import { Address, parseEther } from "viem";
import { DisputeTargetTag } from "@story-protocol/core-sdk";
import { client, networkInfo } from "../utils/config";
import { mintNFT } from "../utils/mint-nft";
import { uploadJSONToIPFS, uploadTextToIPFS } from "../utils/pinata";
import {
  StoryProtocolService,
  ProjectIPMetadata,
  ProjectNFTMetadata,
  DerivativeProjectData,
  ProjectDisputeData,
} from "../services/story";

interface ProjectIPRegistration {
  registrationId: string;
  projectId: string;
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
  projectId: string;
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
  private licensesTableName: string;
  private royaltiesTableName: string;
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

    this.projectsTableName = process.env.IP_PROJECTS_TABLE!;
    this.licensesTableName = process.env.PROJECT_LICENSES_TABLE!;
    this.royaltiesTableName = process.env.ROYALTY_TRANSACTIONS_TABLE!;
    this.bucketName = process.env.PROJECT_IP_BUCKET!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
  }

  async processTask(task: any): Promise<void> {
    console.log(`🔗 Processing Story Protocol IP task: ${task.type}`);

    try {
      switch (task.type) {
        case "REGISTER_GITHUB_PROJECT":
          const registration = await this.registerGitHubProject(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            registration,
          });
          break;

        case "CREATE_PROJECT_FORK":
          const fork = await this.createProjectFork(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            fork,
          });
          break;

        case "CREATE_PROJECT_REMIX":
          const remix = await this.createProjectRemix(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            remix,
          });
          break;

        case "CREATE_OPEN_SOURCE_PROJECT":
          const openSource = await this.createOpenSourceProject(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            openSource,
          });
          break;

        case "DISPUTE_PROJECT_IP":
          const dispute = await this.disputeProjectIP(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            dispute,
          });
          break;

        case "CLAIM_DEVELOPER_ROYALTIES":
          const royalties = await this.claimDeveloperRoyalties(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            royalties,
          });
          break;

        case "PAY_PROJECT_LICENSE_FEE":
          const payment = await this.payProjectLicenseFee(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            payment,
          });
          break;

        case "GET_PROJECT_IP_DETAILS":
          const details = await this.getProjectIPDetails(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            details,
          });
          break;
      }
    } catch (error: any) {
      console.error(`❌ Story Protocol task failed: ${error.message}`);
      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        null,
        error.message
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
      projectId: payload.projectId,
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

    // Store registration in DynamoDB
    await this.storeProjectRegistration(registration);

    // Store metadata in S3
    await this.storeProjectMetadata(registration.registrationId, {
      projectMetadata,
      nftMetadata,
      storyResponse,
    });

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
      ],
    };

    const forkResponse = await this.storyService.createDerivativeProject(
      projectMetadata,
      nftMetadata,
      payload.parentProjectData
    );

    const license: ProjectLicense = {
      licenseId: randomUUID(),
      projectId: payload.projectId,
      parentIpId: payload.parentProjectData.parentIpIds[0],
      derivativeIpId: forkResponse.ipId as Address,
      licenseType: "commercial_fork",
      txHash: forkResponse.txHash,
      createdAt: new Date().toISOString(),
    };

    await this.storeProjectLicense(license);

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
      projectId: payload.projectId,
      parentIpId: payload.parentProjectData.parentIpIds[0],
      derivativeIpId: remixResponse.ipId as Address,
      licenseType: "custom_remix",
      txHash: remixResponse.txHash,
      createdAt: new Date().toISOString(),
    };

    await this.storeProjectLicense(license);

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
  }): Promise<ProjectLicense> {
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
      projectId: payload.projectId,
      parentIpId: payload.parentProjectId,
      derivativeIpId: openSourceResponse.ipId as Address,
      licenseType: "open_source",
      txHash: openSourceResponse.txHash,
      createdAt: new Date().toISOString(),
    };

    await this.storeProjectLicense(license);

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
      liveness: payload.livenessMonths * 30 * 24 * 60 * 60, // Convert months to seconds
    };

    const dispute = await this.storyService.disputeProjectIP(disputeData);

    // Store dispute record
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

    await this.storeRoyaltyTransaction(transaction);
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

    await this.storeRoyaltyTransaction(transaction);
    return transaction;
  }

  async getProjectIPDetails(payload: { projectIpId: Address }): Promise<any> {
    console.log(`🔍 Fetching project IP details: ${payload.projectIpId}`);

    const details = await this.storyService.getProjectIPDetails(
      payload.projectIpId
    );

    // Also fetch stored registration data
    const storedData = await this.getStoredProjectRegistration(
      payload.projectIpId
    );

    return {
      onChainDetails: details,
      registrationData: storedData,
      timestamp: new Date().toISOString(),
    };
  }

  private async storeProjectRegistration(
    registration: ProjectIPRegistration
  ): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.projectsTableName,
        Item: marshall(registration),
      })
    );
  }

  private async storeProjectLicense(license: ProjectLicense): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.licensesTableName,
        Item: marshall(license),
      })
    );
  }

  private async storeRoyaltyTransaction(
    transaction: RoyaltyTransaction
  ): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.royaltiesTableName,
        Item: marshall(transaction),
      })
    );
  }

  private async storeProjectMetadata(
    registrationId: string,
    metadata: any
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `projects/${registrationId}/metadata.json`,
        Body: JSON.stringify(metadata),
        ContentType: "application/json",
      })
    );
  }

  private async getStoredProjectRegistration(
    ipId: Address
  ): Promise<ProjectIPRegistration | null> {
    try {
      const response = await this.dynamodb.send(
        new QueryCommand({
          TableName: this.projectsTableName,
          IndexName: "ipId-index",
          KeyConditionExpression: "ipId = :ipId",
          ExpressionAttributeValues: marshall({
            ":ipId": ipId,
          }),
        })
      );

      if (response.Items && response.Items.length > 0) {
        return unmarshall(response.Items[0]) as ProjectIPRegistration;
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch stored registration:", error);
      return null;
    }
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string
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
              result,
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
