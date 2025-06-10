// src/agents/blockchain-ip.ts
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import {
  KMSClient,
  SignCommand,
  GetPublicKeyCommand,
} from "@aws-sdk/client-kms";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

interface BlockchainTransaction {
  transactionId: string;
  projectId: string;
  type:
    | "ip_registration"
    | "license_creation"
    | "revenue_split"
    | "proof_generation";
  chainId: number;
  txHash?: string;
  status: "pending" | "confirmed" | "failed";
  gasUsed?: number;
  blockNumber?: number;
  timestamp: number;
  metadata: Record<string, any>;
}

interface IPAsset {
  assetId: string;
  projectId: string;
  title: string;
  description: string;
  ipType: "copyright" | "patent" | "trademark" | "trade_secret";
  registrationId?: string;
  blockchainProof?: string;
  licenseTerms?: any;
  createdAt: string;
  updatedAt: string;
}

export class IPAgent {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private kms: KMSClient;
  private sqs: SQSClient;
  private bedrock: BedrockRuntimeClient;
  private transactionsTableName: string;
  private projectsTableName: string;
  private bucketName: string;
  private kmsKeyId: string;
  private orchestratorQueue: string;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.kms = new KMSClient({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

    this.transactionsTableName = process.env.BLOCKCHAIN_TRANSACTIONS_TABLE!;
    this.projectsTableName = process.env.PROJECTS_TABLE_NAME!;
    this.bucketName = process.env.BLOCKCHAIN_IP_BUCKET!;
    this.kmsKeyId = process.env.BLOCKCHAIN_KMS_KEY_ID!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
  }

  async processTask(task: any): Promise<void> {
    console.log(`⛓️ Processing blockchain/IP task: ${task.type}`);

    try {
      switch (task.type) {
        case "REGISTER_IP":
          const ipAsset = await this.registerIP(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            ipAsset,
          });
          break;

        case "CREATE_LICENSE":
          const license = await this.createLicense(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            license,
          });
          break;

        case "GENERATE_PROOF":
          const proof = await this.generateZKProof(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            proof,
          });
          break;

        case "SETUP_REVENUE_SPLIT":
          const revenueSplit = await this.setupRevenueSplit(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            revenueSplit,
          });
          break;

        case "VERIFY_OWNERSHIP":
          const verification = await this.verifyOwnership(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            verification,
          });
          break;
      }
    } catch (error: any) {
      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        null,
        error.message
      );
      throw error;
    }
  }

  async registerIP(payload: {
    projectId: string;
    title: string;
    description: string;
    ipType: string;
    files?: string[];
  }): Promise<IPAsset> {
    const assetId = randomUUID();
    const ipAsset: IPAsset = {
      assetId,
      projectId: payload.projectId,
      title: payload.title,
      description: payload.description,
      ipType: payload.ipType as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Generate blockchain proof
    const proofData = await this.generateIPProof(ipAsset);
    ipAsset.blockchainProof = proofData.proofHash;

    // TODO: Integrate with Story Protocol for IP registration
    console.log(`📝 Registering IP on Story Protocol: ${payload.title}`);

    // Store IP asset data
    await this.storeIPAsset(ipAsset);

    // Store files in S3 if provided
    if (payload.files) {
      for (const file of payload.files) {
        await this.storeIPFile(assetId, file);
      }
    }

    // Record blockchain transaction
    const transaction: BlockchainTransaction = {
      transactionId: randomUUID(),
      projectId: payload.projectId,
      type: "ip_registration",
      chainId: 1, // Ethereum mainnet
      status: "pending",
      timestamp: Date.now(),
      metadata: { assetId, title: payload.title },
    };

    await this.storeTransaction(transaction);

    return ipAsset;
  }

  async createLicense(payload: {
    assetId: string;
    licenseType: "exclusive" | "non_exclusive" | "royalty_free";
    terms: any;
    royaltyPercentage?: number;
  }): Promise<any> {
    const license = {
      licenseId: randomUUID(),
      assetId: payload.assetId,
      licenseType: payload.licenseType,
      terms: payload.terms,
      royaltyPercentage: payload.royaltyPercentage || 0,
      createdAt: new Date().toISOString(),
    };

    // TODO: Create smart contract for license
    console.log(`📄 Creating license contract for asset ${payload.assetId}`);

    // Store license data
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `licenses/${license.licenseId}.json`,
        Body: JSON.stringify(license),
        ContentType: "application/json",
      })
    );

    return license;
  }

  async generateZKProof(payload: {
    projectId: string;
    proofType: "ownership" | "authenticity" | "creation_time";
    data: any;
  }): Promise<any> {
    console.log(`🔐 Generating ZK proof for ${payload.proofType}`);

    // TODO: Implement actual ZK proof generation
    // This would use libraries like snarkjs, circom, etc.

    const proof = {
      proofId: randomUUID(),
      projectId: payload.projectId,
      proofType: payload.proofType,
      proofData: this.mockZKProof(),
      generatedAt: new Date().toISOString(),
      verified: true,
    };

    // Store proof
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `proofs/${proof.proofId}.json`,
        Body: JSON.stringify(proof),
        ContentType: "application/json",
      })
    );

    return proof;
  }

  async setupRevenueSplit(payload: {
    projectId: string;
    participants: Array<{ address: string; percentage: number; role: string }>;
  }): Promise<any> {
    console.log(`💰 Setting up revenue split for project ${payload.projectId}`);

    // TODO: Deploy revenue split smart contract
    // This would create a contract that automatically distributes payments

    const revenueSplit = {
      contractId: randomUUID(),
      projectId: payload.projectId,
      participants: payload.participants,
      contractAddress: `0x${randomUUID().replace(/-/g, "").substring(0, 40)}`,
      deployedAt: new Date().toISOString(),
    };

    // Record transaction
    const transaction: BlockchainTransaction = {
      transactionId: randomUUID(),
      projectId: payload.projectId,
      type: "revenue_split",
      chainId: 1,
      status: "pending",
      timestamp: Date.now(),
      metadata: revenueSplit,
    };

    await this.storeTransaction(transaction);

    return revenueSplit;
  }

  async verifyOwnership(payload: {
    assetId: string;
    claimantAddress: string;
  }): Promise<any> {
    console.log(`✅ Verifying ownership of asset ${payload.assetId}`);

    // TODO: Check blockchain records for ownership

    const verification = {
      verificationId: randomUUID(),
      assetId: payload.assetId,
      claimantAddress: payload.claimantAddress,
      isOwner: true, // Mock result
      verifiedAt: new Date().toISOString(),
      evidence: ["blockchain_record", "ip_registration"],
    };

    return verification;
  }

  private async generateIPProof(
    ipAsset: IPAsset
  ): Promise<{ proofHash: string; signature: string }> {
    const dataToSign = JSON.stringify({
      assetId: ipAsset.assetId,
      title: ipAsset.title,
      timestamp: ipAsset.createdAt,
    });

    // Sign with KMS
    const signature = await this.kms.send(
      new SignCommand({
        KeyId: this.kmsKeyId,
        Message: new TextEncoder().encode(dataToSign),
        SigningAlgorithm: "ECDSA_SHA_256",
      })
    );

    const proofHash = Buffer.from(signature.Signature!).toString("hex");

    return { proofHash, signature: proofHash };
  }

  private mockZKProof(): any {
    // Mock ZK proof structure
    return {
      proof: {
        a: [
          "0x" + randomUUID().replace(/-/g, ""),
          "0x" + randomUUID().replace(/-/g, ""),
        ],
        b: [
          [
            "0x" + randomUUID().replace(/-/g, ""),
            "0x" + randomUUID().replace(/-/g, ""),
          ],
          [
            "0x" + randomUUID().replace(/-/g, ""),
            "0x" + randomUUID().replace(/-/g, ""),
          ],
        ],
        c: [
          "0x" + randomUUID().replace(/-/g, ""),
          "0x" + randomUUID().replace(/-/g, ""),
        ],
      },
      publicSignals: ["1", "1"],
    };
  }

  private async storeIPAsset(ipAsset: IPAsset): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `ip-assets/${ipAsset.assetId}.json`,
        Body: JSON.stringify(ipAsset),
        ContentType: "application/json",
      })
    );
  }

  private async storeIPFile(assetId: string, fileData: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `ip-assets/${assetId}/files/${randomUUID()}`,
        Body: fileData,
        ContentType: "application/octet-stream",
      })
    );
  }

  private async storeTransaction(
    transaction: BlockchainTransaction
  ): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.transactionsTableName,
        Item: marshall(transaction),
      })
    );
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
              agent: "blockchain-ip",
            },
          }),
        })
      );
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}
