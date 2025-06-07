// src/orchestrator/core-orchestrator.ts
import express from "express";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient, PutItemCommand, GetItemCommand, } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient, PutEventsCommand, } from "@aws-sdk/client-eventbridge";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { BillingService } from "../services/billing";
export class CoreOrchestratorAgent {
    sqsClient;
    dynamoClient;
    eventBridgeClient;
    stepFunctionsClient;
    app;
    billingService;
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
    setupMiddleware() {
        this.app.use(express.json({ limit: "10mb" }));
        this.app.use(express.urlencoded({ extended: true }));
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`🎯 Orchestrator: ${req.method} ${req.path} - ${new Date().toISOString()}`);
            next();
        });
    }
    setupRoutes() {
        // =============================================================================
        // GITHUB WORKFLOWS
        // =============================================================================
        // Analyze single repository
        this.app.post("/api/github/analyze", async (req, res) => {
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
                console.log(`🎯 Orchestrator: Starting GitHub analysis workflow for ${repoUrl} (${projectKey})`);
                // Record credit consumption
                await this.billingService.recordGitHubAnalysis(projectKey, repoUrl, workflowId);
                console.log(`🎯 Orchestrator: Starting GitHub analysis workflow for ${repoUrl}`);
                // Create workflow
                const workflow = {
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
            }
            catch (error) {
                console.error("🚨 Orchestrator: GitHub analysis failed:", error);
                res
                    .status(500)
                    .json({ error: "Failed to start analysis", details: error.message });
            }
        });
        // Bulk repository analysis
        this.app.post("/api/github/analyze-bulk", async (req, res) => {
            try {
                const { repoUrls, userId = "anonymous" } = req.body;
                if (!repoUrls || !Array.isArray(repoUrls)) {
                    return res.status(400).json({ error: "repoUrls array is required" });
                }
                const workflowId = uuidv4();
                const taskIds = [];
                console.log(`🎯 Orchestrator: Starting bulk GitHub analysis for ${repoUrls.length} repositories`);
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
            }
            catch (error) {
                console.error("🚨 Orchestrator: Bulk analysis failed:", error);
                res.status(500).json({
                    error: "Failed to start bulk analysis",
                    details: error.message,
                });
            }
        });
        // Get project data
        this.app.get("/api/github/project/:owner/:repo", async (req, res) => {
            try {
                const { owner, repo } = req.params;
                const taskId = uuidv4();
                console.log(`🎯 Orchestrator: Retrieving project data for ${owner}/${repo}`);
                // Send synchronous request to GitHub Intelligence Agent
                const result = await this.sendSyncTaskToAgent("github-intelligence", {
                    taskId,
                    type: "GET_PROJECT_DATA",
                    payload: { owner, repo },
                    priority: "HIGH",
                });
                if (result) {
                    res.json(result);
                }
                else {
                    res.status(404).json({ error: "Project not found" });
                }
            }
            catch (error) {
                console.error("🚨 Orchestrator: Get project failed:", error);
                res.status(500).json({
                    error: "Failed to get project data",
                    details: error.message,
                });
            }
        });
        // =============================================================================
        // CROSS-AGENT WORKFLOWS
        // =============================================================================
        // Complete project launch workflow
        this.app.post("/api/workflows/project-launch", async (req, res) => {
            try {
                const { repoUrl, projectName, socialEnabled, emailEnabled, karmaEnabled, userId, } = req.body;
                const workflowId = uuidv4();
                console.log(`🎯 Orchestrator: Starting complete project launch workflow`);
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
            }
            catch (error) {
                console.error("🚨 Orchestrator: Project launch failed:", error);
                res.status(500).json({
                    error: "Failed to start project launch",
                    details: error.message,
                });
            }
        });
        // =============================================================================
        // WEBHOOK ENDPOINTS
        // =============================================================================
        // GitHub webhook (routed to GitHub Intelligence Agent)
        this.app.post("/webhooks/github", async (req, res) => {
            try {
                const taskId = uuidv4();
                console.log(`🎯 Orchestrator: Received GitHub webhook`);
                // Forward to GitHub Intelligence Agent
                await this.sendTaskToAgent("github-intelligence", {
                    taskId,
                    type: "PROCESS_WEBHOOK",
                    payload: {
                        headers: req.headers,
                        body: req.body,
                    },
                    priority: "HIGH",
                });
                // Immediate response to GitHub
                res.status(200).json({ received: true, taskId });
            }
            catch (error) {
                console.error("🚨 Orchestrator: GitHub webhook failed:", error);
                res.status(500).json({ error: "Webhook processing failed" });
            }
        });
        // =============================================================================
        // WORKFLOW MANAGEMENT
        // =============================================================================
        // Get workflow status
        this.app.get("/api/workflows/:workflowId", async (req, res) => {
            try {
                const { workflowId } = req.params;
                const workflow = await this.getWorkflow(workflowId);
                if (!workflow) {
                    return res.status(404).json({ error: "Workflow not found" });
                }
                res.json(workflow);
            }
            catch (error) {
                res.status(500).json({ error: "Failed to get workflow status" });
            }
        });
        // Get user's active workflows
        this.app.get("/api/users/:userId/workflows", async (req, res) => {
            try {
                const { userId } = req.params;
                const workflows = await this.getUserWorkflows(userId);
                res.json(workflows);
            }
            catch (error) {
                res.status(500).json({ error: "Failed to get user workflows" });
            }
        });
        // =============================================================================
        // BILLING & FINANCIAL ENDPOINTS
        // =============================================================================
        // Get financial information for a project
        this.app.get("/api/billing/:projectKey/financials", async (req, res) => {
            try {
                const { projectKey } = req.params;
                console.log(`💰 Orchestrator: Getting financials for ${projectKey}`);
                // Get project financials
                const financials = await this.billingService.getProjectFinancials(projectKey);
                if (!financials) {
                    return res.status(404).json({
                        error: "Project not found",
                        projectKey,
                    });
                }
                // Get payment history
                const payments = await this.billingService.getProjectPayments(projectKey, 50);
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
            }
            catch (error) {
                console.error("🚨 Orchestrator: Get financials failed:", error);
                res.status(500).json({
                    error: "Failed to get financial information",
                    details: error.message,
                });
            }
        });
        // Get credit consumption details for a project
        this.app.get("/api/billing/:projectKey/consumptions", async (req, res) => {
            try {
                const { projectKey } = req.params;
                const { fromDate, toDate, limit = 100, agentName } = req.query;
                console.log(`📊 Orchestrator: Getting consumptions for ${projectKey}`);
                // Get credit consumptions
                let consumptions = await this.billingService.getCreditConsumptions(projectKey, fromDate, toDate, parseInt(limit));
                // Filter by agent if specified
                if (agentName) {
                    consumptions = consumptions.filter((c) => c.agentName === agentName);
                }
                // Calculate total consumed
                const totalConsumed = consumptions.reduce((sum, c) => sum + c.usdConsumed, 0);
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
                        averageConsumption: totalConsumed / Math.max(consumptions.length, 1),
                        topActions: this.getTopActions(consumptions),
                        agentBreakdown: this.getAgentBreakdown(consumptions),
                    },
                };
                res.json(response);
            }
            catch (error) {
                console.error("🚨 Orchestrator: Get consumptions failed:", error);
                res.status(500).json({
                    error: "Failed to get consumption data",
                    details: error.message,
                });
            }
        });
        // Record a payment (called by Web3 payment handler)
        this.app.post("/api/billing/:projectKey/payments", async (req, res) => {
            try {
                const { projectKey } = req.params;
                const { addressPaid, usdValue, token, amount, txHash, chainId, blockNumber, gasUsed, metadata, } = req.body;
                console.log(`💳 Orchestrator: Recording payment for ${projectKey}: ${usdValue} USD`);
                // Validate required fields
                if (!addressPaid ||
                    !usdValue ||
                    !token ||
                    !amount ||
                    !txHash ||
                    !chainId) {
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
                const updatedFinancials = await this.billingService.getProjectFinancials(projectKey);
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
            }
            catch (error) {
                console.error("🚨 Orchestrator: Record payment failed:", error);
                res.status(500).json({
                    error: "Failed to record payment",
                    details: error.message,
                });
            }
        });
        // Generate new project key
        this.app.post("/api/billing/generate-project-key", async (req, res) => {
            try {
                const { projectName } = req.body;
                if (!projectName) {
                    return res.status(400).json({ error: "projectName is required" });
                }
                const projectKey = this.billingService.generateProjectKey(projectName);
                res.json({
                    projectKey,
                    projectName,
                    generated: new Date().toISOString(),
                });
            }
            catch (error) {
                console.error("🚨 Orchestrator: Generate project key failed:", error);
                res.status(500).json({
                    error: "Failed to generate project key",
                    details: error.message,
                });
            }
        });
        // Get billing summary across all projects (admin endpoint)
        this.app.get("/api/billing/summary", async (req, res) => {
            try {
                const topConsumers = await this.billingService.getTopConsumingProjects(10);
                res.json({
                    topConsumingProjects: topConsumers,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
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
        this.app.get("/health", (req, res) => {
            res.json({
                status: "healthy",
                service: "core-orchestrator",
                timestamp: new Date().toISOString(),
                version: "1.0.0",
            });
        });
        // Agent status
        this.app.get("/api/system/agents", async (req, res) => {
            try {
                const agentStatus = await this.getAgentStatus();
                res.json(agentStatus);
            }
            catch (error) {
                res.status(500).json({ error: "Failed to get agent status" });
            }
        });
    }
    // =============================================================================
    // AGENT COMMUNICATION
    // =============================================================================
    async sendTaskToAgent(agentName, task) {
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
    async sendSyncTaskToAgent(agentName, task) {
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
                }
                else if (status?.status === "FAILED") {
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
    async publishEvent(eventType, detail) {
        const command = new PutEventsCommand({
            Entries: [
                {
                    Source: "core-orchestrator",
                    DetailType: eventType,
                    Detail: JSON.stringify(detail),
                    EventBusName: process.env.EVENT_BUS_NAME || "default",
                },
            ],
        });
        await this.eventBridgeClient.send(command);
        console.log(`📡 Orchestrator: Published event ${eventType}`);
    }
    async startStepFunctionWorkflow(stateMachineArn, input) {
        const command = new StartExecutionCommand({
            stateMachineArn: process.env[`${stateMachineArn.toUpperCase().replace("-", "_")}_ARN`],
            input: JSON.stringify(input),
            name: `${input.workflowId}-${Date.now()}`,
        });
        await this.stepFunctionsClient.send(command);
        console.log(`🔄 Orchestrator: Started Step Function workflow ${stateMachineArn}`);
    }
    // =============================================================================
    // DATA MANAGEMENT
    // =============================================================================
    async storeWorkflow(workflow) {
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
    async getWorkflow(workflowId) {
        const tableName = process.env.WORKFLOWS_TABLE || "orchestrator-workflows";
        const command = new GetItemCommand({
            TableName: tableName,
            Key: marshall({ workflowId }),
        });
        const response = await this.dynamoClient.send(command);
        return response.Item ? unmarshall(response.Item) : null;
    }
    async storeTaskStatus(status) {
        const tableName = process.env.TASK_STATUS_TABLE || "orchestrator-tasks";
        const command = new PutItemCommand({
            TableName: tableName,
            Item: marshall(status),
        });
        await this.dynamoClient.send(command);
    }
    async getTaskStatus(taskId) {
        const tableName = process.env.TASK_STATUS_TABLE || "orchestrator-tasks";
        const command = new GetItemCommand({
            TableName: tableName,
            Key: marshall({ taskId }),
        });
        const response = await this.dynamoClient.send(command);
        return response.Item ? unmarshall(response.Item) : null;
    }
    async getUserWorkflows(userId) {
        // Implementation for getting user workflows
        // This would use DynamoDB query with GSI on userId
        return [];
    }
    async getAgentStatus() {
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
    getAgentQueueUrl(agentName) {
        const envVar = `${agentName.toUpperCase().replace("-", "_")}_QUEUE_URL`;
        const queueUrl = process.env[envVar];
        if (!queueUrl) {
            throw new Error(`Queue URL not found for agent: ${agentName} (${envVar})`);
        }
        return queueUrl;
    }
    // Helper methods for consumption analysis
    getTopActions(consumptions) {
        const actionMap = new Map();
        consumptions.forEach((c) => {
            if (actionMap.has(c.action)) {
                const existing = actionMap.get(c.action);
                actionMap.set(c.action, {
                    count: existing.count + 1,
                    totalCost: existing.totalCost + c.usdConsumed,
                });
            }
            else {
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
    getAgentBreakdown(consumptions) {
        const agentMap = new Map();
        consumptions.forEach((c) => {
            if (agentMap.has(c.agentName)) {
                const existing = agentMap.get(c.agentName);
                agentMap.set(c.agentName, {
                    count: existing.count + 1,
                    totalCost: existing.totalCost + c.usdConsumed,
                });
            }
            else {
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
    start(port = 3000) {
        this.app.listen(port, () => {
            console.log(`🎯 Core Orchestrator Agent running on port ${port}`);
            console.log(`📡 GitHub webhook: http://localhost:${port}/webhooks/github`);
            console.log(`🔍 GitHub analysis: POST http://localhost:${port}/api/github/analyze`);
            console.log(`📊 Project data: GET http://localhost:${port}/api/github/project/:owner/:repo`);
            console.log(`🚀 Project launch: POST http://localhost:${port}/api/workflows/project-launch`);
            console.log(`📋 Health check: http://localhost:${port}/health`);
        });
    }
}
