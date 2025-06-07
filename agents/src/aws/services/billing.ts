// src/services/billing-service.ts
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 as uuidv4 } from "uuid";
import {
  CreditConsumption,
  PaymentRecord,
  ProjectFinancials,
} from "../types/billing";

export class BillingService {
  private dynamoClient: DynamoDBClient;

  // AWS Cost estimates with 10% markup for revenue
  private readonly AWS_COSTS = {
    // DynamoDB costs (per million operations)
    DYNAMODB_WRITE: 1.25 * 1.1, // $1.25 + 10%
    DYNAMODB_READ: 0.25 * 1.1, // $0.25 + 10%

    // S3 costs (per GB)
    S3_STORAGE: 0.023 * 1.1, // $0.023 + 10%
    S3_PUT: 0.0005 * 1.1, // $0.0005 + 10%
    S3_GET: 0.0004 * 1.1, // $0.0004 + 10%

    // SQS costs (per million requests)
    SQS_REQUEST: 0.4 * 1.1, // $0.40 + 10%

    // EventBridge costs (per million events)
    EVENTBRIDGE: 1.0 * 1.1, // $1.00 + 10%

    // Compute costs (estimated per operation)
    LIGHT_COMPUTE: 0.001 * 1.1, // $0.001 + 10%
    MEDIUM_COMPUTE: 0.005 * 1.1, // $0.005 + 10%
    HEAVY_COMPUTE: 0.02 * 1.1, // $0.02 + 10%

    // GitHub API costs (estimated per call)
    GITHUB_API_CALL: 0.0001 * 1.1, // $0.0001 + 10%

    // Webhook processing
    WEBHOOK_PROCESS: 0.0005 * 1.1, // $0.0005 + 10%
  };

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
  }

  // =============================================================================
  // CREDIT CONSUMPTION TRACKING
  // =============================================================================

  async recordCreditConsumption(
    consumption: Omit<CreditConsumption, "consumptionId" | "timestamp">
  ): Promise<void> {
    const consumptionRecord: CreditConsumption = {
      ...consumption,
      consumptionId: uuidv4(),
      timestamp: new Date().toISOString(),
    };

    // Store consumption record
    await this.storeCreditConsumption(consumptionRecord);

    // Update project financials
    await this.updateProjectFinancials(
      consumption.projectKey,
      consumption.usdConsumed
    );

    console.log(
      `💰 Recorded ${consumption.usdConsumed} USD consumption for ${consumption.projectKey} - ${consumption.action}`
    );
  }

  async recordGitHubAnalysis(
    projectKey: string,
    repoUrl: string,
    workflowId?: string
  ): Promise<void> {
    // GitHub repository analysis involves:
    // - Multiple GitHub API calls (~50-100 calls)
    // - DynamoDB writes (metadata, analysis results)
    // - S3 storage (analysis JSON, markdown summary)
    // - SQS messages
    // - Medium compute for analysis processing

    const estimatedCost =
      this.AWS_COSTS.GITHUB_API_CALL * 75 + // ~75 API calls
      this.AWS_COSTS.DYNAMODB_WRITE * 0.005 + // ~5 writes
      this.AWS_COSTS.S3_PUT * 3 + // 3 S3 objects
      this.AWS_COSTS.S3_STORAGE * 0.001 + // ~1MB storage
      this.AWS_COSTS.SQS_REQUEST * 0.003 + // ~3 SQS messages
      this.AWS_COSTS.MEDIUM_COMPUTE; // Analysis processing

    await this.recordCreditConsumption({
      projectKey,
      agentName: "github-intelligence",
      action: "repository_analysis",
      description: `Complete analysis of repository: ${repoUrl}`,
      usdConsumed: parseFloat(estimatedCost.toFixed(6)),
      workflowId,
      metadata: { repoUrl },
    });
  }

  async recordWebhookProcessing(
    projectKey: string,
    repoName: string,
    commitsCount: number
  ): Promise<void> {
    // Webhook processing involves:
    // - GitHub API calls for commit details
    // - DynamoDB updates
    // - S3 updates (analysis, change history)
    // - Light compute for processing

    const estimatedCost =
      this.AWS_COSTS.GITHUB_API_CALL * commitsCount + // API calls per commit
      this.AWS_COSTS.DYNAMODB_WRITE * 0.002 + // ~2 writes
      this.AWS_COSTS.S3_PUT * 2 + // Update 2 S3 objects
      this.AWS_COSTS.WEBHOOK_PROCESS + // Base webhook processing
      this.AWS_COSTS.LIGHT_COMPUTE; // Processing compute

    await this.recordCreditConsumption({
      projectKey,
      agentName: "github-intelligence",
      action: "webhook_processing",
      description: `Processed webhook for ${repoName} with ${commitsCount} commits`,
      usdConsumed: parseFloat(estimatedCost.toFixed(6)),
      metadata: { repoName, commitsCount },
    });
  }

  async recordBulkAnalysis(
    projectKey: string,
    repoCount: number,
    workflowId?: string
  ): Promise<void> {
    // Bulk analysis scales with repository count
    const singleAnalysisCost =
      this.AWS_COSTS.GITHUB_API_CALL * 75 +
      this.AWS_COSTS.DYNAMODB_WRITE * 0.005 +
      this.AWS_COSTS.S3_PUT * 3 +
      this.AWS_COSTS.S3_STORAGE * 0.001 +
      this.AWS_COSTS.MEDIUM_COMPUTE;

    const totalCost = singleAnalysisCost * repoCount;

    await this.recordCreditConsumption({
      projectKey,
      agentName: "github-intelligence",
      action: "bulk_repository_analysis",
      description: `Bulk analysis of ${repoCount} repositories`,
      usdConsumed: parseFloat(totalCost.toFixed(4)),
      workflowId,
      metadata: { repoCount },
    });
  }

  async recordProjectLaunchWorkflow(
    projectKey: string,
    enabledAgents: string[],
    workflowId?: string
  ): Promise<void> {
    // Project launch workflow involves multiple agents
    // Base cost + cost per enabled agent
    const baseCost = this.AWS_COSTS.HEAVY_COMPUTE;
    const agentCost = enabledAgents.length * this.AWS_COSTS.MEDIUM_COMPUTE;
    const coordinationCost =
      this.AWS_COSTS.SQS_REQUEST * 0.01 + // Multiple SQS messages
      this.AWS_COSTS.EVENTBRIDGE * 0.005 + // EventBridge events
      this.AWS_COSTS.DYNAMODB_WRITE * 0.01; // Multiple DB writes

    const totalCost = baseCost + agentCost + coordinationCost;

    await this.recordCreditConsumption({
      projectKey,
      agentName: "core-orchestrator",
      action: "project_launch_workflow",
      description: `Complete project launch with ${enabledAgents.length} agents`,
      usdConsumed: parseFloat(totalCost.toFixed(4)),
      workflowId,
      metadata: { enabledAgents },
    });
  }

  async recordSocialMediaCampaign(
    projectKey: string,
    platforms: string[],
    postsCount: number
  ): Promise<void> {
    // Social media campaign costs
    const platformCost = platforms.length * this.AWS_COSTS.MEDIUM_COMPUTE;
    const postingCost = postsCount * this.AWS_COSTS.LIGHT_COMPUTE;
    const storageCost = this.AWS_COSTS.S3_STORAGE * 0.005; // Campaign data storage

    const totalCost = platformCost + postingCost + storageCost;

    await this.recordCreditConsumption({
      projectKey,
      agentName: "social-media",
      action: "social_media_campaign",
      description: `Campaign across ${platforms.length} platforms with ${postsCount} posts`,
      usdConsumed: parseFloat(totalCost.toFixed(4)),
      metadata: { platforms, postsCount },
    });
  }

  async recordEmailOutreach(
    projectKey: string,
    emailCount: number,
    templateGeneration: boolean = false
  ): Promise<void> {
    // Email outreach costs
    const emailCost = emailCount * 0.001 * 1.1; // $0.001 per email + 10%
    const templateCost = templateGeneration ? this.AWS_COSTS.MEDIUM_COMPUTE : 0;
    const processingCost = this.AWS_COSTS.LIGHT_COMPUTE;

    const totalCost = emailCost + templateCost + processingCost;

    await this.recordCreditConsumption({
      projectKey,
      agentName: "email-communication",
      action: "email_outreach",
      description: `Email outreach to ${emailCount} recipients${
        templateGeneration ? " with template generation" : ""
      }`,
      usdConsumed: parseFloat(totalCost.toFixed(4)),
      metadata: { emailCount, templateGeneration },
    });
  }

  async recordBlockchainOperation(
    projectKey: string,
    operation: string,
    gasEstimate?: string
  ): Promise<void> {
    // Blockchain operations (excluding actual gas fees)
    const operationCost = this.AWS_COSTS.HEAVY_COMPUTE; // Smart contract interaction
    const monitoringCost = this.AWS_COSTS.LIGHT_COMPUTE; // Transaction monitoring

    const totalCost = operationCost + monitoringCost;

    await this.recordCreditConsumption({
      projectKey,
      agentName: "blockchain-ip",
      action: "blockchain_operation",
      description: `Blockchain operation: ${operation}`,
      usdConsumed: parseFloat(totalCost.toFixed(4)),
      metadata: { operation, gasEstimate },
    });
  }

  // =============================================================================
  // PAYMENT RECORDING
  // =============================================================================

  async recordPayment(
    payment: Omit<PaymentRecord, "paymentId" | "timestamp">
  ): Promise<void> {
    const paymentRecord: PaymentRecord = {
      ...payment,
      paymentId: uuidv4(),
      timestamp: new Date().toISOString(),
    };

    // Store payment record
    await this.storePaymentRecord(paymentRecord);

    // Update project financials
    await this.updateProjectFinancials(payment.projectKey, 0, payment.usdValue);

    console.log(
      `💳 Recorded ${payment.usdValue} USD payment for ${payment.projectKey}`
    );
  }

  // =============================================================================
  // FINANCIAL QUERIES
  // =============================================================================

  async getProjectFinancials(
    projectKey: string
  ): Promise<ProjectFinancials | null> {
    const tableName =
      process.env.PROJECT_FINANCIALS_TABLE || "project-financials";

    const command = new GetItemCommand({
      TableName: tableName,
      Key: marshall({ projectKey }),
    });

    const response = await this.dynamoClient.send(command);
    return response.Item
      ? (unmarshall(response.Item) as ProjectFinancials)
      : null;
  }

  async getProjectPayments(
    projectKey: string,
    limit: number = 50
  ): Promise<PaymentRecord[]> {
    const tableName = process.env.PAYMENT_RECORDS_TABLE || "payment-records";

    const command = new QueryCommand({
      TableName: tableName,
      IndexName: "projectKey-timestamp-index",
      KeyConditionExpression: "projectKey = :projectKey",
      ExpressionAttributeValues: marshall({
        ":projectKey": projectKey,
      }),
      ScanIndexForward: false, // Latest first
      Limit: limit,
    });

    const response = await this.dynamoClient.send(command);
    return response.Items
      ? response.Items.map((item) => unmarshall(item) as PaymentRecord)
      : [];
  }

  async getCreditConsumptions(
    projectKey: string,
    fromDate?: string,
    toDate?: string,
    limit: number = 100
  ): Promise<CreditConsumption[]> {
    const tableName =
      process.env.CREDIT_CONSUMPTIONS_TABLE || "credit-consumptions";

    let keyConditionExpression = "projectKey = :projectKey";
    const expressionValues: any = { ":projectKey": projectKey };

    if (fromDate && toDate) {
      keyConditionExpression += " AND #timestamp BETWEEN :fromDate AND :toDate";
      expressionValues[":fromDate"] = fromDate;
      expressionValues[":toDate"] = toDate;
    }

    const command = new QueryCommand({
      TableName: tableName,
      IndexName: "projectKey-timestamp-index",
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeNames:
        fromDate && toDate ? { "#timestamp": "timestamp" } : undefined,
      ExpressionAttributeValues: marshall(expressionValues),
      ScanIndexForward: false, // Latest first
      Limit: limit,
    });

    const response = await this.dynamoClient.send(command);
    return response.Items
      ? response.Items.map((item) => unmarshall(item) as CreditConsumption)
      : [];
  }

  // =============================================================================
  // STORAGE OPERATIONS
  // =============================================================================

  private async storeCreditConsumption(
    consumption: CreditConsumption
  ): Promise<void> {
    const tableName =
      process.env.CREDIT_CONSUMPTIONS_TABLE || "credit-consumptions";

    const command = new PutItemCommand({
      TableName: tableName,
      Item: marshall(consumption),
    });

    await this.dynamoClient.send(command);
  }

  private async storePaymentRecord(payment: PaymentRecord): Promise<void> {
    const tableName = process.env.PAYMENT_RECORDS_TABLE || "payment-records";

    const command = new PutItemCommand({
      TableName: tableName,
      Item: marshall(payment),
    });

    await this.dynamoClient.send(command);
  }

  private async updateProjectFinancials(
    projectKey: string,
    additionalConsumed: number = 0,
    additionalPaid: number = 0
  ): Promise<void> {
    const tableName =
      process.env.PROJECT_FINANCIALS_TABLE || "project-financials";

    // Get current financials or create new
    let financials = await this.getProjectFinancials(projectKey);

    if (!financials) {
      financials = {
        projectKey,
        totalDue: 0,
        totalOverallUsed: 0,
        totalOverallPaid: 0,
        creditBalance: 0,
        lastUpdated: new Date().toISOString(),
        status: "active",
      };
    }

    // Update values
    financials.totalOverallUsed += additionalConsumed;
    financials.totalOverallPaid += additionalPaid;
    financials.creditBalance =
      financials.totalOverallPaid - financials.totalOverallUsed;
    financials.totalDue = Math.max(
      0,
      financials.totalOverallUsed - financials.totalOverallPaid
    );
    financials.lastUpdated = new Date().toISOString();

    // Update status based on balance
    if (financials.creditBalance < -10) {
      // $10 negative balance threshold
      financials.status = "overdue";
    } else if (financials.creditBalance < 0) {
      financials.status = "suspended";
    } else {
      financials.status = "active";
    }

    const command = new PutItemCommand({
      TableName: tableName,
      Item: marshall(financials),
    });

    await this.dynamoClient.send(command);
  }

  // =============================================================================
  // PROJECT KEY GENERATION
  // =============================================================================

  generateProjectKey(projectName: string): string {
    // Clean project name and add random suffix
    const cleanName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    return `${cleanName}-${randomSuffix}`;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  async getTopConsumingProjects(
    limit: number = 10
  ): Promise<Array<{ projectKey: string; totalConsumed: number }>> {
    // Implementation would scan the financials table and return top consumers
    // This is a simplified version - in production you'd use proper indexing
    return [];
  }

  async getConsumptionsByAgent(
    projectKey: string,
    agentName: string
  ): Promise<CreditConsumption[]> {
    const allConsumptions = await this.getCreditConsumptions(projectKey);
    return allConsumptions.filter((c) => c.agentName === agentName);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 6,
    }).format(amount);
  }
}
