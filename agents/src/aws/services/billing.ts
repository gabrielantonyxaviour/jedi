import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 as uuidv4 } from "uuid";

export class BillingService {
  private dynamoClient: DynamoDBClient;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
  }

  generateProjectKey(projectName: string): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const random = Math.random().toString(36).substring(2, 8);
    return `${sanitized}-${random}`;
  }

  async recordGitHubAnalysis(
    projectKey: string,
    repoUrl: string,
    workflowId: string
  ): Promise<void> {
    const consumptionId = uuidv4();
    const usdConsumed = 0.1; // $0.10 per analysis

    await this.recordCreditConsumption({
      projectKey,
      consumptionId,
      agentName: "github-intelligence",
      action: "REPOSITORY_ANALYSIS",
      description: `Analysis of ${repoUrl}`,
      usdConsumed,
      workflowId,
      metadata: { repoUrl },
    });
  }

  async recordCreditConsumption(consumption: any): Promise<void> {
    const tableName =
      process.env.CREDIT_CONSUMPTIONS_TABLE || "credit-consumptions";

    const item = {
      ...consumption,
      timestamp: new Date().toISOString(),
    };

    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(item),
      })
    );

    // Update project financials
    await this.updateProjectFinancials(
      consumption.projectKey,
      consumption.usdConsumed
    );
  }

  async updateProjectFinancials(
    projectKey: string,
    usdConsumed: number
  ): Promise<void> {
    const tableName =
      process.env.PROJECT_FINANCIALS_TABLE || "project-financials";

    // Get existing or create new
    let financials = await this.getProjectFinancials(projectKey);

    if (!financials) {
      financials = {
        projectKey,
        totalOverallUsed: 0,
        totalOverallPaid: 0,
        creditBalance: 0,
        status: "active",
        createdAt: new Date().toISOString(),
      };
    }

    financials.totalOverallUsed += usdConsumed;
    financials.totalDue = Math.max(
      0,
      financials.totalOverallUsed - financials.totalOverallPaid
    );
    financials.creditBalance =
      financials.totalOverallPaid - financials.totalOverallUsed;
    financials.lastUpdated = new Date().toISOString();

    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(financials),
      })
    );
  }

  async getProjectFinancials(projectKey: string): Promise<any> {
    const tableName =
      process.env.PROJECT_FINANCIALS_TABLE || "project-financials";

    const response = await this.dynamoClient.send(
      new GetItemCommand({
        TableName: tableName,
        Key: marshall({ projectKey }),
      })
    );

    return response.Item ? unmarshall(response.Item) : null;
  }

  async recordPayment(payment: any): Promise<void> {
    const tableName = process.env.PAYMENT_RECORDS_TABLE || "payment-records";

    const item = {
      ...payment,
      paymentId: uuidv4(),
      timestamp: new Date().toISOString(),
    };

    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(item),
      })
    );

    // Update project financials
    await this.updateProjectFinancials(payment.projectKey, -payment.usdValue);
  }

  async getCreditConsumptions(
    projectKey: string,
    fromDate?: string,
    toDate?: string,
    limit: number = 100
  ): Promise<any[]> {
    // Simplified implementation - would use proper GSI query in production
    return [];
  }

  async getProjectPayments(
    projectKey: string,
    limit: number = 50
  ): Promise<any[]> {
    // Simplified implementation - would use proper GSI query in production
    return [];
  }

  async getTopConsumingProjects(limit: number = 10): Promise<any[]> {
    // Simplified implementation - would scan all projects in production
    return [];
  }
}
