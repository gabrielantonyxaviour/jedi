// src/orchestrator/core-orchestrator.ts
import express from "express";
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { BillingService } from "../services/billing";
import crypto from "crypto";

interface UserContext {
  userId: string;
  preferences: any;
  conversationHistory: any[];
  activeWorkflows: string[];
  lastActivity: string;
}

interface WorkflowRequest {
  type:
    | "GITHUB_ANALYSIS"
    | "SOCIAL_CAMPAIGN"
    | "LEAD_GENERATION"
    | "EMAIL_OUTREACH"
    | "BLOCKCHAIN_OPERATION"
    | "KARMA_SYNC"
    | "IP_MONITORING";
  payload: any;
  userId: string;
  workflowId: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

interface TaskStatus {
  taskId: string;
  workflowId: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  agent: string;
  startTime: string;
  endTime?: string;
  result?: any;
  error?: string;
}

export class CoreOrchestratorAgent {
  private sqsClient: SQSClient;
  private dynamoClient: DynamoDBClient;
  private eventBridgeClient: EventBridgeClient;
  private stepFunctionsClient: SFNClient;
  private app: express.Application;
  private billingService: BillingService;
  private clientWebhooks: string[] = [];

  constructor() {
    this.sqsClient = new SQSClient({ region: process.env.AWS_REGION });
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.eventBridgeClient = new EventBridgeClient({
      region: process.env.AWS_REGION,
    });
    this.stepFunctionsClient = new SFNClient({
      region: process.env.AWS_REGION,
    });
    this.billingService = new BillingService();
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Special handling for GitHub webhooks - need raw body for signature verification
    this.app.use("/webhooks/github", express.raw({ type: "application/json" }));

    // JSON parsing for other endpoints
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: any, res: any, next: any) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes() {
    // =============================================================================
    // GITHUB WORKFLOWS
    // =============================================================================

    // Analyze single repository
    this.app.post("/api/github/analyze", async (req: any, res: any) => {
      try {
        const { repoUrl, userId = "anonymous", projectKey } = req.body;

        if (!repoUrl) {
          return res.status(400).json({ error: "repoUrl is required" });
        }

        if (!projectKey) {
          return res
            .status(400)
            .json({ error: "projectKey is required for billing" });
        }

        const workflowId = uuidv4();

        console.log(
          `🎯 Orchestrator: Starting GitHub analysis workflow for ${repoUrl} (${projectKey})`
        );

        // Record credit consumption
        await this.billingService.recordGitHubAnalysis(
          projectKey,
          repoUrl,
          workflowId
        );

        console.log(
          `🎯 Orchestrator: Starting GitHub analysis workflow for ${repoUrl}`
        );

        // Create workflow
        const workflow: WorkflowRequest = {
          type: "GITHUB_ANALYSIS",
          workflowId,
          userId,
          priority: "HIGH",
          payload: {
            repoUrl,
            includeWebhook: true,
            analysisDepth: "full",
          },
        };

        // Send to GitHub Intelligence Agent
        await this.sendTaskToAgent("github-intelligence", {
          taskId: uuidv4(),
          workflowId,
          type: "ANALYZE_REPOSITORY",
          payload: workflow.payload,
          priority: "HIGH",
        });

        // Store workflow
        await this.storeWorkflow(workflow);

        res.json({
          success: true,
          workflowId,
          projectKey,
          message: "GitHub analysis workflow initiated",
          status: "PENDING",
        });
      } catch (error: any) {
        console.error("🚨 Orchestrator: GitHub analysis failed:", error);
        res
          .status(500)
          .json({ error: "Failed to start analysis", details: error.message });
      }
    });

    // Bulk repository analysis
    this.app.post("/api/github/analyze-bulk", async (req: any, res: any) => {
      try {
        const { repoUrls, userId = "anonymous" } = req.body;

        if (!repoUrls || !Array.isArray(repoUrls)) {
          return res.status(400).json({ error: "repoUrls array is required" });
        }

        const workflowId = uuidv4();
        const taskIds = [];

        console.log(
          `🎯 Orchestrator: Starting bulk GitHub analysis for ${repoUrls.length} repositories`
        );

        // Create tasks for each repo
        for (const repoUrl of repoUrls) {
          const taskId = uuidv4();
          taskIds.push(taskId);

          await this.sendTaskToAgent("github-intelligence", {
            taskId,
            workflowId,
            type: "ANALYZE_REPOSITORY",
            payload: { repoUrl, includeWebhook: true },
            priority: "MEDIUM",
          });
        }

        // Store workflow
        await this.storeWorkflow({
          type: "GITHUB_ANALYSIS",
          workflowId,
          userId,
          priority: "MEDIUM",
          payload: { repoUrls, taskIds, bulk: true },
        });

        res.json({
          success: true,
          workflowId,
          taskIds,
          message: `Bulk analysis initiated for ${repoUrls.length} repositories`,
          status: "PENDING",
        });
      } catch (error: any) {
        console.error("🚨 Orchestrator: Bulk analysis failed:", error);
        res.status(500).json({
          error: "Failed to start bulk analysis",
          details: error.message,
        });
      }
    });

    // Get project data
    this.app.get(
      "/api/github/project/:owner/:repo",
      async (req: any, res: any) => {
        try {
          const { owner, repo } = req.params;
          console.log(
            `🎯 Orchestrator: Retrieving project data for ${owner}/${repo}`
          );
        } catch (error: any) {
          console.error("🚨 Orchestrator: Get project failed:", error);
          res.status(500).json({
            error: "Failed to get project data",
            details: error.message,
          });
        }
      }
    );

    // Add these routes to the orchestrator (add to setupRoutes method)

    // =============================================================================
    // KARMA WORKFLOWS
    // =============================================================================

    // Create Karma project
    this.app.post("/api/karma/projects", async (req: any, res: any) => {
      try {
        const {
          projectId,
          title,
          description,
          imageURL,
          links,
          tags,
          ownerAddress,
          members,
          userEmail,
          userName,
        } = req.body;

        const workflowId = uuidv4();

        console.log(
          `🎯 Orchestrator: Starting Karma project creation for ${title}`
        );

        await this.sendTaskToAgent("karma-integration", {
          taskId: uuidv4(),
          workflowId,
          type: "CREATE_KARMA_PROJECT",
          payload: {
            projectId,
            title,
            description,
            imageURL,
            links,
            tags,
            ownerAddress,
            members,
            userEmail,
            userName,
          },
          priority: "HIGH",
        });

        res.json({
          success: true,
          workflowId,
          message: "Karma project creation initiated",
          status: "PENDING",
        });
      } catch (error: any) {
        console.error("🚨 Orchestrator: Karma project creation failed:", error);
        res.status(500).json({
          error: "Failed to create Karma project",
          details: error.message,
        });
      }
    });

    // Apply for grant
    this.app.post("/api/karma/grants/apply", async (req: any, res: any) => {
      try {
        const {
          karmaProjectId,
          grantTitle,
          grantDescription,
          proposalURL,
          communityUID,
          cycle,
          season,
          userEmail,
          userName,
        } = req.body;

        const workflowId = uuidv4();

        console.log(
          `🎯 Orchestrator: Starting grant application for ${grantTitle}`
        );

        await this.sendTaskToAgent("karma-integration", {
          taskId: uuidv4(),
          workflowId,
          type: "APPLY_FOR_GRANT",
          payload: {
            karmaProjectId,
            grantTitle,
            grantDescription,
            proposalURL,
            communityUID,
            cycle,
            season,
            userEmail,
            userName,
          },
          priority: "HIGH",
        });

        res.json({
          success: true,
          workflowId,
          message: "Grant application initiated",
          status: "PENDING",
        });
      } catch (error: any) {
        console.error("🚨 Orchestrator: Grant application failed:", error);
        res.status(500).json({
          error: "Failed to apply for grant",
          details: error.message,
        });
      }
    });

    // Create milestone
    this.app.post("/api/karma/milestones", async (req: any, res: any) => {
      try {
        const {
          karmaProjectId,
          grantUID,
          title,
          description,
          endsAt,
          userEmail,
          userName,
        } = req.body;

        const workflowId = uuidv4();

        console.log(
          `🎯 Orchestrator: Starting milestone creation for ${title}`
        );

        // Start multi-step workflow
        await this.startKarmaMilestoneWorkflow({
          workflowId,
          karmaProjectId,
          grantUID,
          title,
          description,
          endsAt,
          userEmail,
          userName,
        });

        res.json({
          success: true,
          workflowId,
          message: "Milestone creation workflow initiated",
          status: "PENDING",
          estimatedSteps: 3,
        });
      } catch (error: any) {
        console.error("🚨 Orchestrator: Milestone creation failed:", error);
        res.status(500).json({
          error: "Failed to create milestone",
          details: error.message,
        });
      }
    });

    // Complete milestone
    this.app.post(
      "/api/karma/milestones/:milestoneUID/complete",
      async (req: any, res: any) => {
        try {
          const { milestoneUID } = req.params;
          const {
            karmaProjectId,
            title,
            description,
            proofOfWork,
            userEmail,
            userName,
          } = req.body;

          const workflowId = uuidv4();

          console.log(
            `🎯 Orchestrator: Starting milestone completion for ${milestoneUID}`
          );

          // Start multi-step workflow
          await this.startKarmaMilestoneCompletionWorkflow({
            workflowId,
            karmaProjectId,
            milestoneUID,
            title,
            description,
            proofOfWork,
            userEmail,
            userName,
          });

          res.json({
            success: true,
            workflowId,
            message: "Milestone completion workflow initiated",
            status: "PENDING",
            estimatedSteps: 3,
          });
        } catch (error: any) {
          console.error("🚨 Orchestrator: Milestone completion failed:", error);
          res.status(500).json({
            error: "Failed to complete milestone",
            details: error.message,
          });
        }
      }
    );

    // Get Karma project status
    this.app.get(
      "/api/karma/projects/:karmaProjectId",
      async (req: any, res: any) => {
        try {
          const { karmaProjectId } = req.params;

          const result = await this.sendSyncTaskToAgent("karma-integration", {
            taskId: uuidv4(),
            workflowId: uuidv4(),
            type: "GET_KARMA_PROJECT",
            payload: { karmaProjectId },
            priority: "MEDIUM",
          });

          if (!result) {
            return res.status(404).json({ error: "Karma project not found" });
          }

          res.json(result);
        } catch (error: any) {
          console.error("🚨 Orchestrator: Get Karma project failed:", error);
          res.status(500).json({
            error: "Failed to get Karma project",
            details: error.message,
          });
        }
      }
    );

    // Sync Karma data
    this.app.post("/api/karma/sync", async (req: any, res: any) => {
      try {
        const { projectId } = req.body;
        const workflowId = uuidv4();

        console.log(`🎯 Orchestrator: Starting Karma data sync`);

        await this.sendTaskToAgent("karma-integration", {
          taskId: uuidv4(),
          workflowId,
          type: "SYNC_KARMA_DATA",
          payload: { projectId },
          priority: "MEDIUM",
        });

        res.json({
          success: true,
          workflowId,
          message: "Karma data sync initiated",
          status: "PENDING",
        });
      } catch (error: any) {
        console.error("🚨 Orchestrator: Karma sync failed:", error);
        res.status(500).json({
          error: "Failed to sync Karma data",
          details: error.message,
        });
      }
    });

    // =============================================================================
    // CROSS-AGENT WORKFLOWS
    // =============================================================================

    // Complete project launch workflow
    this.app.post(
      "/api/workflows/project-launch",
      async (req: any, res: any) => {
        try {
          const {
            repoUrl,
            projectName,
            socialEnabled,
            emailEnabled,
            karmaEnabled,
            userId,
          } = req.body;
          const workflowId = uuidv4();

          console.log(
            `🎯 Orchestrator: Starting complete project launch workflow`
          );

          // Start Step Function for complex workflow
          await this.startStepFunctionWorkflow("project-launch-workflow", {
            workflowId,
            userId,
            repoUrl,
            projectName,
            enabledAgents: {
              social: socialEnabled,
              email: emailEnabled,
              karma: karmaEnabled,
            },
          });

          res.json({
            success: true,
            workflowId,
            message: "Project launch workflow initiated",
            estimatedTime: "5-10 minutes",
          });
        } catch (error: any) {
          console.error("🚨 Orchestrator: Project launch failed:", error);
          res.status(500).json({
            error: "Failed to start project launch",
            details: error.message,
          });
        }
      }
    );

    // =============================================================================
    // WEBHOOK ENDPOINTS
    // =============================================================================

    // GitHub webhook (routed to GitHub Intelligence Agent)
    this.app.post("/webhooks/github", async (req: any, res: any) => {
      try {
        const taskId = uuidv4();
        const workflowId = uuidv4();

        // Verify GitHub webhook signature
        const signature = req.headers["x-hub-signature-256"];
        if (!this.verifyGitHubSignature(req.body, signature)) {
          return res.status(401).json({ error: "Invalid signature" });
        }

        // Parse the JSON body
        const webhookData = JSON.parse(req.body.toString());

        console.log(`🔔 Orchestrator: Received GitHub webhook`);

        // Forward to GitHub Intelligence Agent for processing
        await this.sendTaskToAgent("github-intelligence", {
          taskId,
          workflowId,
          type: "PROCESS_WEBHOOK",
          payload: {
            headers: req.headers,
            body: webhookData,
          },
          priority: "HIGH",
        });

        // Immediate response to GitHub
        res.status(200).json({ received: true, taskId });
      } catch (error: any) {
        console.error("🚨 Orchestrator: GitHub webhook failed:", error);
        res.status(500).json({ error: "Webhook processing failed" });
      }
    });

    // =============================================================================
    // WORKFLOW MANAGEMENT
    // =============================================================================

    // Get workflow status
    this.app.get("/api/workflows/:workflowId", async (req: any, res: any) => {
      try {
        const { workflowId } = req.params;
        const workflow = await this.getWorkflow(workflowId);

        if (!workflow) {
          return res.status(404).json({ error: "Workflow not found" });
        }

        res.json(workflow);
      } catch (error: any) {
        res.status(500).json({ error: "Failed to get workflow status" });
      }
    });

    // Get user's active workflows
    this.app.get("/api/users/:userId/workflows", async (req: any, res: any) => {
      try {
        const { userId } = req.params;
        const workflows = await this.getUserWorkflows(userId);
        res.json(workflows);
      } catch (error: any) {
        res.status(500).json({ error: "Failed to get user workflows" });
      }
    });

    // =============================================================================
    // BILLING & FINANCIAL ENDPOINTS
    // =============================================================================

    // Get financial information for a project
    this.app.get(
      "/api/billing/:projectKey/financials",
      async (req: any, res: any) => {
        try {
          const { projectKey } = req.params;

          console.log(`💰 Orchestrator: Getting financials for ${projectKey}`);

          // Get project financials
          const financials = await this.billingService.getProjectFinancials(
            projectKey
          );

          if (!financials) {
            return res.status(404).json({
              error: "Project not found",
              projectKey,
            });
          }

          // Get payment history
          const payments = await this.billingService.getProjectPayments(
            projectKey,
            50
          );

          const response = {
            totalDue: financials.totalDue,
            totalOverallUsed: financials.totalOverallUsed,
            totalOverallPaid: financials.totalOverallPaid,
            creditBalance: financials.creditBalance,
            status: financials.status,
            lastUpdated: financials.lastUpdated,
            payments: payments.map((payment) => ({
              paymentId: payment.paymentId,
              addressPaid: payment.addressPaid,
              usdValue: payment.usdValue,
              token: payment.token,
              amount: payment.amount,
              txHash: payment.txHash,
              chainId: payment.chainId,
              timestamp: payment.timestamp,
              status: payment.status,
              blockNumber: payment.blockNumber,
              gasUsed: payment.gasUsed,
              metadata: payment.metadata,
            })),
          };

          res.json(response);
        } catch (error: any) {
          console.error("🚨 Orchestrator: Get financials failed:", error);
          res.status(500).json({
            error: "Failed to get financial information",
            details: error.message,
          });
        }
      }
    );

    // Get credit consumption details for a project
    this.app.get(
      "/api/billing/:projectKey/consumptions",
      async (req: any, res: any) => {
        try {
          const { projectKey } = req.params;
          const { fromDate, toDate, limit = 100, agentName } = req.query;

          console.log(
            `📊 Orchestrator: Getting consumptions for ${projectKey}`
          );

          // Get credit consumptions
          let consumptions = await this.billingService.getCreditConsumptions(
            projectKey,
            fromDate as string,
            toDate as string,
            parseInt(limit as string)
          );

          // Filter by agent if specified
          if (agentName) {
            consumptions = consumptions.filter(
              (c) => c.agentName === agentName
            );
          }

          // Calculate total consumed
          const totalConsumed = consumptions.reduce(
            (sum, c) => sum + c.usdConsumed,
            0
          );

          const response = {
            projectKey,
            totalConsumed,
            consumptions: consumptions.map((consumption) => ({
              consumptionId: consumption.consumptionId,
              agentName: consumption.agentName,
              action: consumption.action,
              description: consumption.description,
              usdConsumed: consumption.usdConsumed,
              timestamp: consumption.timestamp,
              workflowId: consumption.workflowId,
              taskId: consumption.taskId,
              metadata: consumption.metadata,
            })),
            dateRange: {
              from: fromDate || "all-time",
              to: toDate || "all-time",
            },
            summary: {
              totalRecords: consumptions.length,
              averageConsumption:
                totalConsumed / Math.max(consumptions.length, 1),
              topActions: this.getTopActions(consumptions),
              agentBreakdown: this.getAgentBreakdown(consumptions),
            },
          };

          res.json(response);
        } catch (error: any) {
          console.error("🚨 Orchestrator: Get consumptions failed:", error);
          res.status(500).json({
            error: "Failed to get consumption data",
            details: error.message,
          });
        }
      }
    );

    // Record a payment (called by Web3 payment handler)
    this.app.post(
      "/api/billing/:projectKey/payments",
      async (req: any, res: any) => {
        try {
          const { projectKey } = req.params;
          const {
            addressPaid,
            usdValue,
            token,
            amount,
            txHash,
            chainId,
            blockNumber,
            gasUsed,
            metadata,
          } = req.body;

          console.log(
            `💳 Orchestrator: Recording payment for ${projectKey}: ${usdValue} USD`
          );

          // Validate required fields
          if (
            !addressPaid ||
            !usdValue ||
            !token ||
            !amount ||
            !txHash ||
            !chainId
          ) {
            return res.status(400).json({
              error: "Missing required payment fields",
              required: [
                "addressPaid",
                "usdValue",
                "token",
                "amount",
                "txHash",
                "chainId",
              ],
            });
          }

          await this.billingService.recordPayment({
            projectKey,
            addressPaid,
            usdValue: parseFloat(usdValue),
            token,
            amount,
            txHash,
            chainId: parseInt(chainId),
            status: "confirmed",
            blockNumber,
            gasUsed,
            metadata,
          });

          // Get updated financials
          const updatedFinancials =
            await this.billingService.getProjectFinancials(projectKey);

          res.json({
            success: true,
            message: "Payment recorded successfully",
            payment: {
              usdValue: parseFloat(usdValue),
              txHash,
              chainId: parseInt(chainId),
            },
            updatedBalance: updatedFinancials?.creditBalance || 0,
          });
        } catch (error: any) {
          console.error("🚨 Orchestrator: Record payment failed:", error);
          res.status(500).json({
            error: "Failed to record payment",
            details: error.message,
          });
        }
      }
    );

    // Generate new project key
    this.app.post(
      "/api/billing/generate-project-key",
      async (req: any, res: any) => {
        try {
          const { projectName } = req.body;

          if (!projectName) {
            return res.status(400).json({ error: "projectName is required" });
          }

          const projectKey =
            this.billingService.generateProjectKey(projectName);

          res.json({
            projectKey,
            projectName,
            generated: new Date().toISOString(),
          });
        } catch (error: any) {
          console.error("🚨 Orchestrator: Generate project key failed:", error);
          res.status(500).json({
            error: "Failed to generate project key",
            details: error.message,
          });
        }
      }
    );

    // Get billing summary across all projects (admin endpoint)
    this.app.get("/api/billing/summary", async (req: any, res: any) => {
      try {
        const topConsumers = await this.billingService.getTopConsumingProjects(
          10
        );

        res.json({
          topConsumingProjects: topConsumers,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error("🚨 Orchestrator: Get billing summary failed:", error);
        res.status(500).json({
          error: "Failed to get billing summary",
          details: error.message,
        });
      }
    });

    // =============================================================================
    // SYSTEM ENDPOINTS
    // =============================================================================

    // Health check
    this.app.get("/health", (req: any, res: any) => {
      res.json({
        status: "healthy",
        service: "core-orchestrator",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      });
    });

    // Agent status
    this.app.get("/api/system/agents", async (req: any, res: any) => {
      try {
        const agentStatus = await this.getAgentStatus();
        res.json(agentStatus);
      } catch (error: any) {
        res.status(500).json({ error: "Failed to get agent status" });
      }
    });

    // Register client webhook
    this.app.post("/api/webhooks/register", async (req: any, res: any) => {
      const { webhookUrl } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({ error: "webhookUrl is required" });
      }

      if (!this.clientWebhooks.includes(webhookUrl)) {
        this.clientWebhooks.push(webhookUrl);
      }

      res.json({ success: true, registered: webhookUrl });
    });
  }

  // =============================================================================
  // AGENT COMMUNICATION
  // =============================================================================

  private async sendTaskToAgent(agentName: string, task: any): Promise<void> {
    const queueUrl = this.getAgentQueueUrl(agentName);

    console.log(`📤 Orchestrator: Sending task ${task.taskId} to ${agentName}`);

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(task),
      MessageAttributes: {
        TaskType: {
          DataType: "String",
          StringValue: task.type,
        },
        Priority: {
          DataType: "String",
          StringValue: task.priority || "MEDIUM",
        },
        WorkflowId: {
          DataType: "String",
          StringValue: task.workflowId || "",
        },
      },
    });

    await this.sqsClient.send(command);

    // Store task status
    await this.storeTaskStatus({
      taskId: task.taskId,
      workflowId: task.workflowId,
      status: "PENDING",
      agent: agentName,
      startTime: new Date().toISOString(),
    });
  }

  private async sendSyncTaskToAgent(
    agentName: string,
    task: any
  ): Promise<any> {
    // For synchronous operations, send task and wait for result
    // This is simplified - in production you'd implement proper request/response pattern
    await this.sendTaskToAgent(agentName, task);

    // Poll for result (simplified - use proper pub/sub in production)
    return new Promise((resolve) => {
      const pollInterval = setInterval(async () => {
        const status = await this.getTaskStatus(task.taskId);
        if (status?.status === "COMPLETED") {
          clearInterval(pollInterval);
          resolve(status.result);
        } else if (status?.status === "FAILED") {
          clearInterval(pollInterval);
          resolve(null);
        }
      }, 1000);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
        resolve(null);
      }, 30000);
    });
  }

  private async startStepFunctionWorkflow(
    stateMachineArn: string,
    input: any
  ): Promise<void> {
    const command = new StartExecutionCommand({
      stateMachineArn:
        process.env[`${stateMachineArn.toUpperCase().replace("-", "_")}_ARN`],
      input: JSON.stringify(input),
      name: `${input.workflowId}-${Date.now()}`,
    });

    await this.stepFunctionsClient.send(command);
    console.log(
      `🔄 Orchestrator: Started Step Function workflow ${stateMachineArn}`
    );
  }

  // Add these private methods to the CoreOrchestratorAgent class

  private async startKarmaMilestoneWorkflow(params: {
    workflowId: string;
    karmaProjectId: string;
    grantUID: string;
    title: string;
    description: string;
    endsAt: number;
    userEmail?: string;
    userName?: string;
  }): Promise<void> {
    console.log(`🔄 Starting Karma milestone workflow: ${params.workflowId}`);

    // Step 1: Create milestone in Karma
    await this.sendTaskToAgent("karma-integration", {
      taskId: uuidv4(),
      workflowId: params.workflowId,
      type: "CREATE_MILESTONE",
      payload: {
        karmaProjectId: params.karmaProjectId,
        grantUID: params.grantUID,
        title: params.title,
        description: params.description,
        endsAt: params.endsAt,
        userEmail: params.userEmail,
        userName: params.userName,
      },
      priority: "HIGH",
      metadata: { step: 1, totalSteps: 3 },
    });

    // Step 2 & 3 will be triggered by task completion handler
  }

  private async startKarmaMilestoneCompletionWorkflow(params: {
    workflowId: string;
    karmaProjectId: string;
    milestoneUID: string;
    title: string;
    description: string;
    proofOfWork?: string;
    userEmail?: string;
    userName?: string;
  }): Promise<void> {
    console.log(
      `🔄 Starting Karma milestone completion workflow: ${params.workflowId}`
    );

    // Step 1: Complete milestone in Karma
    await this.sendTaskToAgent("karma-integration", {
      taskId: uuidv4(),
      workflowId: params.workflowId,
      type: "COMPLETE_MILESTONE",
      payload: {
        karmaProjectId: params.karmaProjectId,
        milestoneUID: params.milestoneUID,
        title: params.title,
        description: params.description,
        proofOfWork: params.proofOfWork,
        userEmail: params.userEmail,
        userName: params.userName,
      },
      priority: "HIGH",
      metadata: { step: 1, totalSteps: 3 },
    });

    // Step 2 & 3 will be triggered by task completion handler
  }

  // Update the processCompletionMessage method to handle multi-step workflows
  private async processCompletionMessage(message: any) {
    try {
      const data = JSON.parse(message.Body);

      if (data.type === "TASK_COMPLETION") {
        const completion = data.payload;

        // Update task status in DynamoDB
        await this.updateTaskStatus(completion.taskId, {
          status: completion.status,
          endTime: completion.timestamp,
          result: completion.result,
          error: completion.error,
        });

        const workflow = await this.getWorkflow(completion.workflowId);

        if (workflow) {
          // Handle multi-step Karma workflows
          await this.handleKarmaWorkflowStep(completion, workflow);

          const isComplete = await this.checkWorkflowCompletion(
            completion.workflowId
          );

          if (isComplete) {
            console.log(
              `✅ Orchestrator: Completing workflow ${completion.workflowId}`
            );
            await this.completeWorkflow(completion.workflowId);
          }

          // Notify client
          await this.notifyClient(completion.workflowId, {
            type: "TASK_COMPLETED",
            taskId: completion.taskId,
            workflowId: completion.workflowId,
            agent: completion.agent,
            status: completion.status,
            result: completion.result,
            error: completion.error,
          });
        }
      }
    } catch (error) {
      console.error("❌ Error processing completion:", error);
    }
  }

  private async handleKarmaWorkflowStep(
    completion: any,
    workflow: any
  ): Promise<void> {
    if (
      completion.agent !== "karma-integration" ||
      completion.status !== "COMPLETED"
    ) {
      return;
    }

    const task = await this.getTaskDetails(completion.taskId);
    if (!task?.metadata) return;

    const { step, totalSteps } = task.metadata;

    // Handle milestone creation workflow
    if (task.type === "CREATE_MILESTONE" && step === 1) {
      // Step 2: Trigger social media post
      await this.sendTaskToAgent("social-media", {
        taskId: uuidv4(),
        workflowId: completion.workflowId,
        type: "POST_MILESTONE_CREATED",
        payload: {
          projectTitle: completion.result?.projectTitle || "Project",
          milestoneTitle: task.payload.title,
          dueDate: new Date(task.payload.endsAt).toLocaleDateString(),
          karmaUID: completion.result?.milestoneUID,
        },
        priority: "MEDIUM",
        metadata: { step: 2, totalSteps },
      });
    } else if (task.type === "POST_MILESTONE_CREATED" && step === 2) {
      // Step 3: Send confirmation email
      await this.sendTaskToAgent("email-communication", {
        taskId: uuidv4(),
        workflowId: completion.workflowId,
        type: "SEND_EMAIL",
        payload: {
          to: [task.payload.userEmail],
          subject: `🎉 Milestone Workflow Complete!`,
          body: `Hi ${task.payload.userName},\n\nYour milestone creation workflow is complete!\n\n✅ Milestone created in Karma\n✅ Social media announcement posted\n✅ Team notifications sent\n\nYou're all set!\n\nBest regards,\nKarma Integration Team`,
        },
        priority: "LOW",
        metadata: { step: 3, totalSteps },
      });
    }

    // Handle milestone completion workflow
    else if (task.type === "COMPLETE_MILESTONE" && step === 1) {
      // Step 2: Trigger social media post
      await this.sendTaskToAgent("social-media", {
        taskId: uuidv4(),
        workflowId: completion.workflowId,
        type: "POST_MILESTONE_COMPLETED",
        payload: {
          projectTitle: completion.result?.projectTitle || "Project",
          milestoneTitle: task.payload.title,
          proofOfWork: task.payload.proofOfWork,
          karmaUID: completion.result?.updateUID,
        },
        priority: "MEDIUM",
        metadata: { step: 2, totalSteps },
      });
    } else if (task.type === "POST_MILESTONE_COMPLETED" && step === 2) {
      // Step 3: Send completion celebration email
      await this.sendTaskToAgent("email-communication", {
        taskId: uuidv4(),
        workflowId: completion.workflowId,
        type: "SEND_EMAIL",
        payload: {
          to: [task.payload.userEmail],
          subject: `🚀 Milestone Completed Successfully!`,
          body: `Hi ${task.payload.userName},\n\nCongratulations! Your milestone completion workflow is finished!\n\n✅ Milestone marked complete in Karma\n✅ Achievement shared on social media\n✅ Community notified\n\nKeep up the amazing work!\n\nBest regards,\nKarma Integration Team`,
        },
        priority: "LOW",
        metadata: { step: 3, totalSteps },
      });
    }
  }

  private async getTaskDetails(taskId: string): Promise<any> {
    // Retrieve task details from DynamoDB
    const tableName = process.env.TASK_STATUS_TABLE || "orchestrator-tasks";

    const command = new GetItemCommand({
      TableName: tableName,
      Key: marshall({ taskId }),
    });

    const response = await this.dynamoClient.send(command);
    return response.Item ? unmarshall(response.Item) : null;
  }

  // =============================================================================
  // DATA MANAGEMENT
  // =============================================================================

  private async storeWorkflow(workflow: WorkflowRequest): Promise<void> {
    const tableName = process.env.WORKFLOWS_TABLE || "orchestrator-workflows";

    const item = {
      workflowId: workflow.workflowId,
      userId: workflow.userId,
      type: workflow.type,
      status: "ACTIVE",
      payload: workflow.payload,
      priority: workflow.priority,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const command = new PutItemCommand({
      TableName: tableName,
      Item: marshall(item),
    });

    await this.dynamoClient.send(command);
  }

  private async getWorkflow(workflowId: string): Promise<any> {
    const tableName = process.env.WORKFLOWS_TABLE || "orchestrator-workflows";

    const command = new GetItemCommand({
      TableName: tableName,
      Key: marshall({ workflowId }),
    });

    const response = await this.dynamoClient.send(command);
    return response.Item ? unmarshall(response.Item) : null;
  }

  private async storeTaskStatus(status: TaskStatus): Promise<void> {
    const tableName = process.env.TASK_STATUS_TABLE || "orchestrator-tasks";

    const command = new PutItemCommand({
      TableName: tableName,
      Item: marshall(status),
    });

    await this.dynamoClient.send(command);
  }

  private verifyGitHubSignature(payload: Buffer, signature: string): boolean {
    if (!signature) {
      console.warn("⚠️ No GitHub signature provided");
      return false;
    }

    const secret = process.env.GITHUB_WEBHOOK_SECRET || "your-secret-here";

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const digest = `sha256=${hmac.digest("hex")}`;

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  private async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    const tableName = process.env.TASK_STATUS_TABLE || "orchestrator-tasks";

    const command = new GetItemCommand({
      TableName: tableName,
      Key: marshall({ taskId }),
    });

    const response = await this.dynamoClient.send(command);
    return response.Item ? (unmarshall(response.Item) as TaskStatus) : null;
  }

  private async getUserWorkflows(userId: string): Promise<any[]> {
    // Implementation for getting user workflows
    // This would use DynamoDB query with GSI on userId
    return [];
  }

  private async getAgentStatus(): Promise<any> {
    // Implementation for checking agent health
    // This would check SQS queue depths, recent activity, etc.
    return {
      "github-intelligence": "healthy",
      "social-media": "healthy",
      "lead-generation": "healthy",
      "email-communication": "healthy",
      "blockchain-ip": "healthy",
      "karma-integration": "healthy",
      "monitoring-compliance": "healthy",
    };
  }

  private getAgentQueueUrl(agentName: string): string {
    const envVar = `${agentName.toUpperCase().replace("-", "_")}_QUEUE_URL`;
    const queueUrl = process.env[envVar];

    if (!queueUrl) {
      throw new Error(
        `Queue URL not found for agent: ${agentName} (${envVar})`
      );
    }

    return queueUrl;
  }

  // Helper methods for consumption analysis
  private getTopActions(
    consumptions: any[]
  ): Array<{ action: string; count: number; totalCost: number }> {
    const actionMap = new Map();

    consumptions.forEach((c) => {
      if (actionMap.has(c.action)) {
        const existing = actionMap.get(c.action);
        actionMap.set(c.action, {
          count: existing.count + 1,
          totalCost: existing.totalCost + c.usdConsumed,
        });
      } else {
        actionMap.set(c.action, {
          count: 1,
          totalCost: c.usdConsumed,
        });
      }
    });

    return Array.from(actionMap.entries())
      .map(([action, data]) => ({ action, ...data }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);
  }

  private getAgentBreakdown(
    consumptions: any[]
  ): Array<{ agent: string; count: number; totalCost: number }> {
    const agentMap = new Map();

    consumptions.forEach((c) => {
      if (agentMap.has(c.agentName)) {
        const existing = agentMap.get(c.agentName);
        agentMap.set(c.agentName, {
          count: existing.count + 1,
          totalCost: existing.totalCost + c.usdConsumed,
        });
      } else {
        agentMap.set(c.agentName, {
          count: 1,
          totalCost: c.usdConsumed,
        });
      }
    });

    return Array.from(agentMap.entries())
      .map(([agent, data]) => ({ agent, ...data }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }

  // =============================================================================
  // SERVER MANAGEMENT
  // =============================================================================

  public start(port: number = 3000): void {
    this.startTaskCompletionListener();

    this.app.listen(port, () => {
      console.log(`🎯 Core Orchestrator Agent running on port ${port}`);
      console.log(
        `📡 GitHub webhook: http://localhost:${port}/webhooks/github`
      );
      console.log(
        `🔍 GitHub analysis: POST http://localhost:${port}/api/github/analyze`
      );
      console.log(
        `📊 Project data: GET http://localhost:${port}/api/github/project/:owner/:repo`
      );
      console.log(
        `🚀 Project launch: POST http://localhost:${port}/api/workflows/project-launch`
      );
      console.log(`📋 Health check: http://localhost:${port}/health`);
      console.log(
        `🔔 Client webhook registration: POST http://localhost:${port}/api/webhooks/register`
      );
    });
  }

  private async startTaskCompletionListener() {
    const orchestratorQueueUrl = process.env.ORCHESTRATOR_QUEUE_URL!;

    // Poll for task completions
    setInterval(async () => {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: orchestratorQueueUrl,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 5,
        });

        const response = await this.sqsClient.send(command);

        if (response.Messages) {
          for (const message of response.Messages) {
            await this.processCompletionMessage(message);

            // Delete processed message
            await this.sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: orchestratorQueueUrl,
                ReceiptHandle: message.ReceiptHandle!,
              })
            );
          }
        }
      } catch (error) {
        console.error("❌ Error processing completions:", error);
      }
    }, 2000);
  }

  private async updateTaskStatus(taskId: string, updates: Partial<TaskStatus>) {
    const tableName = process.env.TASK_STATUS_TABLE || "orchestrator-tasks";

    const updateExpression = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {
      "#status": "status",
    };

    if (updates.status) {
      updateExpression.push("set #status = :status");
      expressionAttributeValues[":status"] = updates.status;
    }
    if (updates.endTime) {
      updateExpression.push("endTime = :endTime");
      expressionAttributeValues[":endTime"] = updates.endTime;
    }
    if (updates.result) {
      updateExpression.push("#result = :result");
      expressionAttributeNames["#result"] = "result";
      expressionAttributeValues[":result"] = updates.result;
    }
    if (updates.error) {
      updateExpression.push("#error = :error");
      expressionAttributeNames["#error"] = "error";
      expressionAttributeValues[":error"] = updates.error;
    }

    const command = new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ taskId }),
      UpdateExpression: updateExpression.join(", "),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
    });

    await this.dynamoClient.send(command);
  }

  private async notifyClient(workflowId: string, notification: any) {
    // Send webhook to registered client endpoints
    for (const webhookUrl of this.clientWebhooks) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflowId,
            timestamp: new Date().toISOString(),
            ...notification,
          }),
        });
      } catch (error) {
        console.error(`Failed to notify client webhook ${webhookUrl}:`, error);
      }
    }
  }

  private async checkWorkflowCompletion(workflowId: string): Promise<boolean> {
    const tableName = process.env.TASK_STATUS_TABLE || "orchestrator-tasks";

    // Get all tasks for this workflow
    const command = new QueryCommand({
      TableName: tableName,
      IndexName: "workflowId-index",
      KeyConditionExpression: "workflowId = :workflowId",
      ExpressionAttributeValues: marshall({
        ":workflowId": workflowId,
      }),
    });

    const response = await this.dynamoClient.send(command);
    const tasks = response.Items || [];

    // Check if all tasks are completed
    return tasks.every(
      (task) => task.status.S === "COMPLETED" || task.status.S === "FAILED"
    );
  }

  private async completeWorkflow(workflowId: string): Promise<void> {
    const tableName = process.env.WORKFLOW_TABLE || "orchestrator-workflows";

    const command = new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ workflowId }),
      UpdateExpression: "set #status = :status, completedAt = :completedAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: marshall({
        ":status": "COMPLETED",
        ":completedAt": new Date().toISOString(),
      }),
    });

    await this.dynamoClient.send(command);
  }
}
