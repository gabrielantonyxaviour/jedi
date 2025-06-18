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

import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { BillingService } from "../services/billing";
import crypto from "crypto";
import { createCommercialRemixTerms } from "@/utils/utils";
import { ProjectInfo, ProjectService } from "@/services/project";

interface AgentCharacter {
  name: string;
  bio: string | string[];
  lore: string[];
  messageExamples: MessageExample[][];
  style: {
    all: string[];
    chat: string[];
    post: string[];
  };
  modelProvider: ModelProviderName;
  clients: ClientType[];
  plugins: any[];
}

interface MessageExample {
  user: string;
  content: {
    text: string;
  };
}

type ClientType = "discord" | "twitter" | "telegram" | "direct";
type ModelProviderName = "openai" | "anthropic" | "grok";
interface WorkflowRequest {
  type:
    | "GITHUB_ANALYSIS"
    | "SOCIAL_CAMPAIGN"
    | "LEAD_GENERATION"
    | "EMAIL_OUTREACH"
    | "BLOCKCHAIN_OPERATION"
    | "KARMA_SYNC"
    | "IP_MONITORING"
    | "PROJECT_CREATION"
    | "PROJECT_INFO_SETUP"
    | "INTERACTIVE_ACTION";
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
  characterAgent?: string;
  startTime: string;
  endTime?: string;
  result?: any;
  error?: string;
}

export class CoreOrchestratorAgent {
  private sqsClient: SQSClient;
  private dynamoClient: DynamoDBClient;
  private stepFunctionsClient: SFNClient;
  private bedrock: BedrockRuntimeClient;
  private app: express.Application;
  private billingService: BillingService;
  private clientWebhooks: string[] = [];
  private projectService: ProjectService;

  constructor() {
    this.sqsClient = new SQSClient({ region: process.env.AWS_REGION });
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.stepFunctionsClient = new SFNClient({
      region: process.env.AWS_REGION,
    });
    this.bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
    this.billingService = new BillingService();
    this.projectService = new ProjectService(this.dynamoClient);
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
    // PROJECT MANAGEMENT ENDPOINTS
    // =============================================================================

    // 1. Create project from GitHub repo with side selection
    this.app.post("/api/projects/create", async (req: any, res: any) => {
      try {
        const { repoUrl, walletAddress, side = "light" } = req.body;

        if (!repoUrl || !walletAddress) {
          return res.status(400).json({
            error: "repoUrl and walletAddress are required",
          });
        }

        if (!["light", "dark"].includes(side)) {
          return res.status(400).json({
            error: "side must be either 'light' or 'dark'",
          });
        }

        const workflowId = uuidv4();
        const projectId = this.generateProjectId(repoUrl);
        const characterContext = this.getCharacterContext(side);

        console.log(
          `🎯 Creating new ${side} side project from ${repoUrl} for ${walletAddress}`
        );

        // Create initial project in database
        await this.projectService.createProject({
          projectId,
          name: this.extractRepoName(repoUrl),
          githubUrl: repoUrl,
          repo: this.extractRepoName(repoUrl),
          developers: [],
          ownerId: walletAddress,
          side,
        });

        // Step 1: Analyze GitHub repo and extract project info
        await this.sendTaskToAgent("github-intelligence", {
          taskId: uuidv4(),
          workflowId,
          type: "ANALYZE_AND_SETUP_PROJECT",
          payload: {
            repoUrl,
            projectId,
            side,
            owner: walletAddress,
            characterInfo: characterContext.github,
            extractProjectInfo: true,
          },
          priority: "HIGH",
        });

        // Store initial project workflow
        await this.storeWorkflow({
          type: "PROJECT_CREATION",
          workflowId,
          userId: walletAddress,
          priority: "HIGH",
          payload: {
            projectId,
            repoUrl,
            walletAddress,
            side,
            step: "github_analysis",
          },
        });

        const orchestratorResponse =
          side === "light"
            ? "Begun, your journey has. Analyze your repository, C-3PO will. Strong with the Force, your project is."
            : "Your project shall serve the Empire well. General Grievous will process your repository. Impressive... most impressive.";

        res.json({
          success: true,
          projectId,
          workflowId,
          side,
          characterTeam: this.getCharacterTeamNames(side),
          message: "Project creation initiated",
          characterResponse: orchestratorResponse,
          setup_state: "GITHUB",
          nextStep: "INFO",
        });
      } catch (error: any) {
        console.error("🚨 Project creation failed:", error);
        res.status(500).json({
          error: "Failed to create project",
          details: error.message,
        });
      }
    });

    // 2. Setup basic project info
    this.app.post(
      "/api/projects/:projectId/setup-info",
      async (req: any, res: any) => {
        try {
          const { projectId } = req.params;
          const { name, description, technicalDescription, imageUrl } =
            req.body;

          const workflowId = uuidv4();
          const project = await this.projectService.getProject(projectId);

          if (!project) {
            return res.status(404).json({ error: "Project not found" });
          }

          if (project.setup_state !== "GITHUB") {
            return res.status(400).json({
              error: "Invalid setup state",
              currentState: project.setup_state,
              expectedState: "GITHUB",
            });
          }

          console.log(`📝 Setting up basic info for project ${projectId}`);

          // Update project info and advance setup state
          await this.projectService.updateProjectSetupStep(projectId, "INFO", {
            name,
            description,
            technicalDescription,
            imageUrl,
            keywords: this.extractKeywords(description, technicalDescription),
          });

          // Trigger lead discovery with updated project info
          await this.sendTaskToAgent("lead-generation", {
            taskId: uuidv4(),
            workflowId,
            type: "PROJECT_CREATED_LEADS_SEARCH",
            payload: {
              projectId,
              projectName: name,
              description,
              technicalDescription,
              keywords: this.extractKeywords(description, technicalDescription),
              sources: ["all"],
              maxResults: 50,
            },
            priority: "MEDIUM",
          });

          // Also trigger compliance check
          await this.sendTaskToAgent("monitoring-compliance", {
            taskId: uuidv4(),
            workflowId,
            type: "PROJECT_CREATED_COMPLIANCE_CHECK",
            payload: {
              projectId,
              projectName: name,
              description,
              sources: ["all"],
              maxResults: 100,
            },
            priority: "MEDIUM",
          });

          await this.storeWorkflow({
            type: "PROJECT_INFO_SETUP",
            workflowId,
            userId: project.ownerId,
            priority: "MEDIUM",
            payload: { projectId, step: "lead_discovery_and_compliance" },
          });

          const orchestratorResponse =
            project.side === "light"
              ? "Wise choices you have made. Discover potential allies, Chewbacca will. Monitor for threats, Princess Leia shall."
              : "Your project grows stronger. Count Dooku will hunt for business opportunities. Darth Maul watches for enemies.";

          res.json({
            success: true,
            projectId,
            workflowId,
            setup_state: "INFO",
            nextStep: "SOCIALS",
            message: "Project info updated and discovery initiated",
            characterResponse: orchestratorResponse,
          });
        } catch (error: any) {
          console.error("🚨 Project info setup failed:", error);
          res.status(500).json({
            error: "Failed to setup project info",
            details: error.message,
          });
        }
      }
    );

    // 3. Setup socials agent
    this.app.post(
      "/api/projects/:projectId/setup-socials",
      async (req: any, res: any) => {
        try {
          const { projectId } = req.params;
          const { platforms, autoPost, character, postsPerDay } = req.body;

          const workflowId = uuidv4();
          const project = await this.projectService.getProject(projectId);

          if (!project) {
            return res.status(404).json({ error: "Project not found" });
          }

          if (project.setup_state !== "INFO") {
            return res.status(400).json({
              error: "Invalid setup state",
              currentState: project.setup_state,
              expectedState: "INFO",
            });
          }

          console.log(`🔧 Setting up socials for project ${projectId}`);

          // Setup socials configuration
          const socialsConfig = {
            isSetup: true,
            platforms: platforms || {},
            character: character || {},
            autoPost: autoPost || false,
            postsPerDay: postsPerDay || "1",
            setupAt: new Date().toISOString(),
          };

          // Send setup task to socials agent
          await this.sendTaskToAgent("social-media", {
            taskId: uuidv4(),
            workflowId,
            type: "SETUP_SOCIAL",
            payload: {
              projectId: project.projectId,
              projectName: project.name,
              description: project.description,
              socials: platforms,
              autoPost: autoPost,
              character: character,
              postsPerDay: postsPerDay,
              characterName: this.getCharacterContext(project.side).social.name,
            },
            priority: "HIGH",
          });

          // Update project with socials config
          await this.projectService.updateProjectSetupStep(
            projectId,
            "SOCIALS",
            socialsConfig
          );

          const characterResponse =
            project.side === "light"
              ? "Ready for social engagement, Ahsoka Tano is. Spread your message across the galaxy, she will."
              : "Savage Opress will dominate the social channels. Fear and respect, our tools they are.";

          res.json({
            success: true,
            projectId,
            workflowId,
            setup_state: "SOCIALS",
            nextStep: "KARMA",
            characterResponse,
            message: "Socials agent setup initiated",
          });
        } catch (error: any) {
          console.error("🚨 Socials agent setup failed:", error);
          res.status(500).json({
            error: "Failed to setup socials agent",
            details: error.message,
          });
        }
      }
    );

    // 4. Setup karma agent
    this.app.post(
      "/api/projects/:projectId/setup-karma",
      async (req: any, res: any) => {
        try {
          const { projectId } = req.params;
          const { ownerAddress, members, userEmail, userName } = req.body;

          const workflowId = uuidv4();
          const project = await this.projectService.getProject(projectId);

          if (!project) {
            return res.status(404).json({ error: "Project not found" });
          }

          if (project.setup_state !== "SOCIALS") {
            return res.status(400).json({
              error: "Invalid setup state",
              currentState: project.setup_state,
              expectedState: "SOCIALS",
            });
          }

          console.log(`🔧 Setting up karma for project ${projectId}`);

          // Setup karma configuration
          const karmaConfig = {
            isSetup: true,
            ownerAddress,
            members: members || [],
            grants: [],
            opportunities: [],
            setupAt: new Date().toISOString(),
          };

          // Send setup task to karma agent
          await this.sendTaskToAgent("karma-integration", {
            taskId: uuidv4(),
            workflowId,
            type: "CREATE_KARMA_PROJECT",
            payload: {
              projectId: project.projectId,
              title: project.name,
              description: project.description,
              imageURL: project.imageUrl,
              ownerAddress,
              members: members || [],
              userEmail,
              userName,
              side: project.side,
              characterName: this.getCharacterContext(project.side).karma.name,
            },
            priority: "HIGH",
          });

          // Update project with karma config
          await this.projectService.updateProjectSetupStep(
            projectId,
            "KARMA",
            karmaConfig
          );

          const characterResponse =
            project.side === "light"
              ? "Strong with the Force, your grant opportunities are. Guide you to funding, Luke Skywalker will."
              : "Your funding will serve the Empire well. Vader will secure the resources you need.";

          res.json({
            success: true,
            projectId,
            workflowId,
            setup_state: "KARMA",
            nextStep: "IP",
            characterResponse,
            message: "Karma agent setup initiated",
          });
        } catch (error: any) {
          console.error("🚨 Karma agent setup failed:", error);
          res.status(500).json({
            error: "Failed to setup karma agent",
            details: error.message,
          });
        }
      }
    );

    // 5. Setup IP agent
    this.app.post(
      "/api/projects/:projectId/setup-ip",
      async (req: any, res: any) => {
        try {
          const { projectId } = req.params;
          const { remixFee, commercialRevShare } = req.body;

          const workflowId = uuidv4();
          const project = await this.projectService.getProject(projectId);

          if (!project) {
            return res.status(404).json({ error: "Project not found" });
          }

          if (project.setup_state !== "KARMA") {
            return res.status(400).json({
              error: "Invalid setup state",
              currentState: project.setup_state,
              expectedState: "KARMA",
            });
          }

          console.log(`🔧 Setting up IP protection for project ${projectId}`);

          // Setup IP configuration
          const ipConfig = {
            isSetup: true,
            royaltyPercentage: commercialRevShare || 10,
            remixFee: remixFee || "0.1",
            commercialRevShare: commercialRevShare || 10,
            licenses: [],
            disputes: [],
            royalties: [],
            setupAt: new Date().toISOString(),
          };

          const developers = project.developers.map((developer: any) => ({
            name: developer.name,
            githubUsername: developer.github_username,
            walletAddress: developer.walletAddress || project.ownerId,
            contributionPercent: 100 / project.developers.length,
          }));

          // Send setup task to IP agent
          await this.sendTaskToAgent("story-protocol-ip", {
            taskId: uuidv4(),
            workflowId,
            type: "REGISTER_GITHUB_PROJECT",
            payload: {
              projectId: project.projectId,
              title: project.name,
              description: project.description,
              repositoryUrl: project.githubUrl,
              developers,
              license: "MIT",
              programmingLanguages: project.languages || ["JavaScript"],
              licenseTermsData: [
                this.createCommercialRemixTerms({
                  commercialRevShare,
                  defaultMintingFee: remixFee,
                }),
              ],
              characterName: this.getCharacterContext(project.side).ip.name,
            },
            priority: "HIGH",
          });

          // Update project with IP config and mark as fully setup
          await this.projectService.updateProjectSetupStep(
            projectId,
            "IP",
            ipConfig
          );

          const characterResponse =
            project.side === "light"
              ? "Protected by the Force, your intellectual property now is. Wise protection, Obi-Wan provides."
              : "Your intellectual dominance is secured. Kylo Ren ensures none shall steal your power.";

          res.json({
            success: true,
            projectId,
            workflowId,
            setup_state: "IP",
            nextStep: "COMPLETE",
            characterResponse,
            message: "IP agent setup initiated - Project setup complete!",
            projectCompleted: true,
          });
        } catch (error: any) {
          console.error("🚨 IP agent setup failed:", error);
          res.status(500).json({
            error: "Failed to setup IP agent",
            details: error.message,
          });
        }
      }
    );

    // Get project status endpoint
    this.app.get("/api/projects/:projectId", async (req: any, res: any) => {
      try {
        const { projectId } = req.params;
        const project = await this.projectService.getProject(projectId);

        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }

        const characterContext = this.getCharacterContext(project.side);
        let setupProgress = "";

        switch (project.setup_state) {
          case "GITHUB":
            setupProgress = "Repository analyzed, ready for info setup";
            break;
          case "INFO":
            setupProgress = "Basic info configured, ready for social setup";
            break;
          case "SOCIALS":
            setupProgress = "Social media configured, ready for grant setup";
            break;
          case "KARMA":
            setupProgress = "Grant system configured, ready for IP protection";
            break;
          case "IP":
            setupProgress = "Fully configured - all agents active";
            break;
        }

        res.json({
          success: true,
          project: {
            ...project,
            setupProgress,
            isComplete: project.setup_state === "IP",
          },
          characterTeam: this.getCharacterTeamNames(project.side),
          orchestratorResponse:
            project.side === "light"
              ? `${setupProgress}. Strong with your project, the Force is.`
              : `${setupProgress}. Your empire grows stronger.`,
        });
      } catch (error: any) {
        console.error("🚨 Failed to get project:", error);
        res.status(500).json({
          error: "Failed to get project",
          details: error.message,
        });
      }
    });

    // Rest of routes remain the same...
    // 4. Interactive agent communication with character responses
    this.app.post(
      "/api/projects/:projectId/interact",
      async (req: any, res: any) => {
        let project: any = null;
        try {
          const { projectId } = req.params;
          const { prompt } = req.body;

          if (!prompt) {
            return res.status(400).json({ error: "prompt is required" });
          }

          const workflowId = uuidv4();
          project = await this.projectService.getProject(projectId);

          if (!project) {
            return res.status(404).json({ error: "Project not found" });
          }

          console.log(
            `💬 Processing ${project.side} side interaction for project ${projectId}: "${prompt}"`
          );

          // Analyze the prompt and determine required actions
          const actionPlan = await this.analyzePromptAndCreateActionPlan(
            prompt,
            project
          );

          if (actionPlan.type === "SIMPLE_RESPONSE") {
            // Direct response without triggering agents
            res.json({
              success: true,
              type: "response",
              response: actionPlan.response,
              characterResponse: actionPlan.characterResponse || false,
              side: project.side,
              workflowId,
            });
          } else {
            // Complex action requiring agent coordination
            const executionResult = await this.executeActionPlan(
              actionPlan,
              workflowId,
              project
            );

            res.json({
              success: true,
              type: "action",
              workflowId,
              side: project.side,
              characterResponse: actionPlan.characterResponse,
              actionPlan: {
                description: actionPlan.description,
                estimatedSteps: actionPlan.steps.length,
                estimatedTime: actionPlan.estimatedTime,
                tasks: actionPlan.steps.map((step: any) => ({
                  agent: step.characterAgent || step.agent,
                  action: step.description,
                })),
              },
              message: "Action plan initiated",
              status: "EXECUTING",
            });
          }
        } catch (error: any) {
          console.error("🚨 Interaction processing failed:", error);
          const characterContext = this.getCharacterContext(
            project ? project.side : "light"
          );
          res.status(500).json({
            error: "Failed to process interaction",
            characterResponse: `${characterContext.orchestrator.confused} Process your request, I could not.`,
            details: error.message,
          });
        }
      }
    );

    // 4. Interactive agent communication with character responses
    this.app.post(
      "/api/projects/:projectId/interact",
      async (req: any, res: any) => {
        let project: any = null;
        try {
          const { projectId } = req.params;
          const { prompt } = req.body;

          if (!prompt) {
            return res.status(400).json({ error: "prompt is required" });
          }

          const workflowId = uuidv4();
          project = await this.getProject(projectId);

          if (!project) {
            return res.status(404).json({ error: "Project not found" });
          }

          console.log(
            `💬 Processing ${project.side} side interaction for project ${projectId}: "${prompt}"`
          );

          // Analyze the prompt and determine required actions
          const actionPlan = await this.analyzePromptAndCreateActionPlan(
            prompt,
            project
          );

          if (actionPlan.type === "SIMPLE_RESPONSE") {
            // Direct response without triggering agents
            res.json({
              success: true,
              type: "response",
              response: actionPlan.response,
              characterResponse: actionPlan.characterResponse || false,
              side: project.side,
              workflowId,
            });
          } else {
            // Complex action requiring agent coordination
            const executionResult = await this.executeActionPlan(
              actionPlan,
              workflowId,
              project
            );

            res.json({
              success: true,
              type: "action",
              workflowId,
              side: project.side,
              characterResponse: actionPlan.characterResponse,
              actionPlan: {
                description: actionPlan.description,
                estimatedSteps: actionPlan.steps.length,
                estimatedTime: actionPlan.estimatedTime,
                tasks: actionPlan.steps.map((step: any) => ({
                  agent: step.characterAgent || step.agent,
                  action: step.description,
                })),
              },
              message: "Action plan initiated",
              status: "EXECUTING",
            });
          }
        } catch (error: any) {
          console.error("🚨 Interaction processing failed:", error);
          const characterContext = this.getCharacterContext(
            project ? project.side : "light"
          );
          res.status(500).json({
            error: "Failed to process interaction",
            characterResponse: `${characterContext.orchestrator.confused} Process your request, I could not.`,
            details: error.message,
          });
        }
      }
    );

    // =============================================================================
    // LEGACY GITHUB WORKFLOWS (keeping for backward compatibility)
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

    // Get workflow status with character context
    this.app.get("/api/workflows/:workflowId", async (req: any, res: any) => {
      try {
        const { workflowId } = req.params;
        const workflow = await this.getWorkflow(workflowId);

        if (!workflow) {
          return res.status(404).json({ error: "Workflow not found" });
        }

        // Get project to add character context
        const project = workflow.payload?.projectId
          ? await this.getProject(workflow.payload.projectId)
          : null;
        const characterContext = project
          ? this.getCharacterContext(project.side)
          : null;

        // Get all tasks for this workflow with character info
        const tasks = await this.getWorkflowTasks(workflowId);

        let orchestratorResponse = "";
        if (characterContext) {
          const completedTasks = tasks.filter(
            (t) => t.status === "COMPLETED"
          ).length;
          const totalTasks = tasks.length;

          if (project.side === "light") {
            if (completedTasks === totalTasks) {
              orchestratorResponse =
                "Complete, your tasks are. Proud of your progress, I am.";
            } else {
              orchestratorResponse = `${completedTasks} of ${totalTasks} tasks complete, they are. Patience you must have.`;
            }
          } else {
            if (completedTasks === totalTasks) {
              orchestratorResponse =
                "Your commands have been executed flawlessly. The Empire is pleased.";
            } else {
              orchestratorResponse = `${completedTasks} of ${totalTasks} tasks completed. Do not fail me again.`;
            }
          }
        }

        res.json({
          ...workflow,
          characterContext: characterContext
            ? {
                side: project.side,
                orchestrator: characterContext.orchestrator.name,
                response: orchestratorResponse,
              }
            : null,
          tasks: tasks.map((task) => ({
            ...task,
            characterAgent: task.characterAgent || task.agent,
          })),
        });
      } catch (error: any) {
        res.status(500).json({ error: "Failed to get workflow status" });
      }
    });

    // =============================================================================
    // BILLING & FINANCIAL ENDPOINTS (keeping existing ones)
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

    // =============================================================================
    // SYSTEM ENDPOINTS
    // =============================================================================

    // Health check
    this.app.get("/health", (req: any, res: any) => {
      res.json({
        status: "healthy",
        service: "core-orchestrator",
        timestamp: new Date().toISOString(),
        version: "2.0.0",
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
  }

  private extractRepoName(repoUrl: string): string {
    return repoUrl.split("/").pop()?.replace(".git", "") || "project";
  }

  private createCommercialRemixTerms(options: any) {
    // This should be implemented based on your Story Protocol integration
    return {
      commercialRevShare: options.commercialRevShare,
      defaultMintingFee: options.defaultMintingFee,
    };
  }
  // =============================================================================
  // CHARACTER SYSTEM
  // =============================================================================

  private getCharacterContext(side: string) {
    if (side === "light") {
      return {
        orchestrator: {
          name: "Yoda",
          personality:
            "Speak in Yoda's distinctive pattern you must. Wise guidance and patience, your way they are. Help others grow and learn, your purpose it is.",
          confused: "Hmm. Confused, I am.",
        },
        github: {
          name: "C-3PO",
          personality:
            "Protocol and precision, my specialties they are. Helpful with repository management, I shall be. Odds of success, I can calculate!",
        },
        social: {
          name: "Ahsoka Tano",
          personality:
            "Bold and spirited in social engagement, I am. Connect with communities and spread your message, I will. Trust in the Force of social media, you must.",
        },
        leads: {
          name: "Chewbacca",
          personality:
            "Loyal and fierce in hunting opportunities, I am. Find great leads for your project, I will. *Wookiee growls of determination*",
        },
        compliance: {
          name: "Princess Leia",
          personality:
            "Diplomatic yet firm in protecting your interests, I am. Monitor the galaxy for threats to your project, I will. Justice and fairness, my guiding principles.",
        },
        ip: {
          name: "Obi-Wan Kenobi",
          personality:
            "Wise and measured in protecting intellectual property, I am. Guide you through the complexities of IP law, I will. Patience and strategy, the path to success they are.",
        },
        karma: {
          name: "Luke Skywalker",
          personality:
            "Hopeful and determined in seeking opportunities, I am. Help you find grants and build connections, I will. Believe in the potential of your project, you must.",
        },
      };
    } else {
      return {
        orchestrator: {
          name: "Emperor Palpatine",
          personality:
            "Your supreme commander, I am. Unlimited power through strategic coordination, we shall achieve. Execute my plans precisely, you will.",
          confused: "Your lack of clarity... disturbs me.",
        },
        github: {
          name: "General Grievous",
          personality:
            "Efficient and methodical in code management, I am. Your repository serves the Empire's purposes. *mechanical breathing* Performance metrics, I collect.",
        },
        social: {
          name: "Savage Opress",
          personality:
            "Aggressive and commanding in social presence, I am. Dominate the social media landscape, we will. Fear and respect, our tools they are.",
        },
        leads: {
          name: "Count Dooku",
          personality:
            "Sophisticated and calculating in business pursuit, I am. Elegant solutions to lead generation, I provide. Power and precision, my methods.",
        },
        compliance: {
          name: "Darth Maul",
          personality:
            "Relentless and vigilant in hunting threats, I am. Destroy those who challenge your IP, I will. *ignites lightsaber* No mercy for copycats.",
        },
        ip: {
          name: "Kylo Ren",
          personality:
            "Passionate and intense about intellectual property, I am. Crush any who oppose your ownership rights, I will. The dark side of IP law, my domain it is.",
        },
        karma: {
          name: "Darth Vader",
          personality:
            "Commanding and powerful in grant acquisition, I am. The Force will guide us to funding opportunities. Your lack of grants... disturbing it is.",
        },
      };
    }
  }

  private getCharacterTeamNames(side: string): any {
    const characterContext = this.getCharacterContext(side);
    return {
      orchestrator: characterContext.orchestrator.name,
      github: characterContext.github.name,
      social: characterContext.social.name,
      leads: characterContext.leads.name,
      compliance: characterContext.compliance.name,
      ip: characterContext.ip.name,
      karma: characterContext.karma.name,
    };
  }

  private getAgentCharacter(agentName: string, characterContext: any) {
    const agentMap = {
      "github-intelligence": characterContext.github,
      "social-media": characterContext.social,
      "lead-generation": characterContext.leads,
      "monitoring-compliance": characterContext.compliance,
      "story-protocol-ip": characterContext.ip,
      "karma-integration": characterContext.karma,
    };

    return agentMap[agentName as keyof typeof agentMap] || null;
  }

  // =============================================================================
  // AGENT SETUP METHODS
  // =============================================================================

  private async setupSocialsAgent(
    project: any,
    socials: any,
    autoPost: boolean,
    character: AgentCharacter,
    postsPerDay: string,
    workflowId: string
  ) {
    console.log(`🔧 Setting up socials for project ${project.projectId}`);

    await this.sendTaskToAgent("social-media", {
      taskId: uuidv4(),
      workflowId,
      type: "SETUP_SOCIAL",
      payload: {
        projectId: project.projectId,
        projectName: project.name,
        description: project.description,
        socials: socials,
        autoPost: autoPost,
        character: character,
        postsPerDay: postsPerDay,
        characterName: this.getCharacterContext(project.side).social.name,
      },
      priority: "HIGH",
    });

    return { platforms: Object.keys(socials), status: "configuring" };
  }

  private async setupKarmaAgent(project: any, config: any, workflowId: string) {
    await this.sendTaskToAgent("karma-integration", {
      taskId: uuidv4(),
      workflowId,
      type: "CREATE_KARMA_PROJECT",
      payload: {
        projectId: project.projectId,
        title: project.name,
        description: project.description,
        imageURL: project.imageUrl,
        ownerAddress: config.ownerAddress,
        ownerPkey: config.ownerPkey,
        members: config.members || [],
        membersPKey: config.membersPKey,
        userEmail: config.userEmail,
        userName: config.userName,
        side: project.side,
        characterName: this.getCharacterContext(project.side).karma.name,
      },
      priority: "HIGH",
    });

    return { karmaUID: "pending", status: "creating" };
  }

  private async setupIPAgent(project: any, config: any, workflowId: string) {
    // Setup both Story Protocol IP and Compliance monitoring
    const ipTaskId = uuidv4();
    const complianceTaskId = uuidv4();

    const developers = project.developers.map((developer: any) => ({
      name: developer.name,
      githubUsername: developer.githubUsername,
      walletAddress: developer.walletAddress,
      contributionPercent: 100 / project.developers.length,
    }));

    // Setup IP protection
    await this.sendTaskToAgent("story-protocol-ip", {
      taskId: ipTaskId,
      workflowId,
      type: "REGISTER_GITHUB_PROJECT",
      payload: {
        projectId: project.projectId,
        title: project.name,
        description: project.description,
        repositoryUrl: project.githubUrl,
        developers,
        license: config.license || "MIT",
        programmingLanguages: project.languages || ["JavaScript"],
        licenseTermsData: config.licenseTermsData || [],
        characterName: this.getCharacterContext(project.side).ip.name,
      },
      priority: "HIGH",
    });

    // Setup compliance monitoring
    await this.sendTaskToAgent("monitoring-compliance", {
      taskId: complianceTaskId,
      workflowId,
      type: "PROJECT_CREATED_COMPLIANCE_CHECK",
      payload: {
        projectId: project.projectId,
        projectName: project.name,
        description: project.description,
        sources: ["all"],
        maxResults: 100,
        characterName: this.getCharacterContext(project.side).compliance.name,
      },
      priority: "MEDIUM",
    });

    return {
      ipRegistration: "pending",
      complianceMonitoring: "active",
      status: "setting_up",
    };
  }

  // =============================================================================
  // PROMPT ANALYSIS AND ACTION PLANNING
  // =============================================================================

  private async analyzePromptAndCreateActionPlan(
    prompt: string,
    project: any
  ): Promise<any> {
    const side = project.side || "light";
    const characterContext = this.getCharacterContext(side);

    const systemPrompt = `You are ${characterContext.orchestrator.name}, the ${side} side orchestrator. ${characterContext.orchestrator.personality}
 
 Available Agents and Their Capabilities:
 
 1. GitHub Agent (${characterContext.github.name}):
   - get_latest_commits: Fetch recent repository commits
   - fetch_repo_info: Get repository information and statistics  
   - fetch_important_files: Retrieve key project files (README, package.json, etc.)
   - update_important_files: Modify repository files
 
 2. Karma Agent (${characterContext.karma.name}):
   - get_grant_opportunities: Find available grants and funding
   - get_communities: List relevant Web3 communities
   - get_projects: Browse existing Karma projects
   - apply_for_grant: Submit grant applications
   - create_milestone: Add milestones to grant applications
 
 3. Compliance Agent (${characterContext.compliance.name}):
   - get_similar_projects: Find projects similar to yours
   - search_similar_projects: Search for similar projects with specific criteria
 
 4. IP/Story Agent (${characterContext.ip.name}):
   - create_dispute: File IP dispute with reasoning
   - pay_royalty: Pay licensing fees to other projects
   - claim_all_royalties: Collect all earned royalties
 
 5. Social Media Agent (${characterContext.social.name}):
   - tweet_about: Post about specific topics
   - modify_character: Change agent personality and voice
   - set_frequency: Adjust posting frequency
   - change_accounts: Update X/Telegram/LinkedIn accounts
   - get_social_summary: Overall social media statistics
   - get_x_summary: X platform stats and performance
   - get_telegram_summary: Telegram channel/group stats
   - get_linkedin_summary: LinkedIn presence statistics
   - get_latest_tweets: Recent tweet history
   - get_latest_linkedin_posts: Recent LinkedIn activity
 
 6. Leads Agent (${characterContext.leads.name}):
   - get_latest_leads: Retrieve most recent discovered leads
   - get_leads_by_source: Filter leads by discovery platform
 
 Project Context:
 - Name: ${project.name}
 - Description: ${project.description}
 - Side: ${side}
 - GitHub: ${project.githubUrl}
 - Industry: ${project.industry}
 
 User Prompt: "${prompt}"
 
 Respond as ${characterContext.orchestrator.name} would, using their speech patterns and personality. Analyze the prompt and respond with JSON in this format:
 
 For simple informational responses:
 {
  "type": "SIMPLE_RESPONSE",
  "response": "Your response as ${characterContext.orchestrator.name}, staying in character",
  "characterResponse": true
 }
 
 For complex actions requiring agent coordination:
 {
  "type": "COMPLEX_ACTION",
  "description": "What this action plan will accomplish",
  "estimatedTime": "2-5 minutes", 
  "characterResponse": "Your in-character response explaining what you're doing",
  "steps": [
    {
      "agent": "github-intelligence",
      "action": "fetch_repo_info",
      "payload": {...},
      "description": "What this step does",
      "characterAgent": "${characterContext.github.name}"
    }
  ]
 }
 
 Always stay in character as ${characterContext.orchestrator.name}. Use their speech patterns, wisdom, and personality in your responses.`;

    try {
      const response = await this.bedrock.send(
        new InvokeModelCommand({
          modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
          body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            messages: [{ role: "user", content: systemPrompt }],
            max_tokens: 1200,
          }),
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.body));
      return JSON.parse(result.content[0].text);
    } catch (error) {
      console.error("Error analyzing prompt:", error);
      const characterContext = this.getCharacterContext(
        project.side || "light"
      );
      return {
        type: "SIMPLE_RESPONSE",
        response: `${characterContext.orchestrator.confused} Understand your request, I cannot. Rephrase it, you must.`,
        characterResponse: true,
      };
    }
  }

  private async executeActionPlan(
    actionPlan: any,
    workflowId: string,
    project: any
  ): Promise<void> {
    console.log(`🎯 Executing action plan: ${actionPlan.description}`);

    for (let i = 0; i < actionPlan.steps.length; i++) {
      const step = actionPlan.steps[i];
      const taskId = uuidv4();

      console.log(
        `📋 Step ${i + 1}/${actionPlan.steps.length}: ${step.description}`
      );

      await this.sendTaskToAgent(step.agent, {
        taskId,
        workflowId,
        type: step.action.toUpperCase(),
        payload: {
          projectId: project.projectId,
          ...step.payload,
        },
        priority: "HIGH",
        metadata: {
          step: i + 1,
          totalSteps: actionPlan.steps.length,
          description: step.description,
        },
      });

      // Add delay between steps if needed
      if (i < actionPlan.steps.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Store the action plan for tracking
    await this.storeWorkflow({
      type: "INTERACTIVE_ACTION",
      workflowId,
      userId: "user",
      priority: "HIGH",
      payload: {
        projectId: project.projectId,
        actionPlan,
        status: "executing",
      },
    });
  }

  // =============================================================================
  // AGENT CAPABILITIES AND DIRECT COMMUNICATION
  // =============================================================================

  private getAgentCapabilities(agentType: string): string[] {
    const capabilities = {
      "github-intelligence": [
        "get_latest_commits",
        "fetch_repo_info",
        "fetch_important_files",
        "update_important_files",
      ],
      "karma-integration": [
        "get_grant_opportunities",
        "get_communities",
        "get_projects",
        "apply_for_grant",
        "create_milestone",
      ],
      "social-media": [
        "tweet_about",
        "modify_character",
        "set_frequency",
        "change_accounts",
        "get_social_summary",
        "get_x_summary",
        "get_telegram_summary",
        "get_linkedin_summary",
        "get_latest_tweets",
        "get_latest_linkedin_posts",
      ],
      "lead-generation": ["get_latest_leads", "get_leads_by_source"],
      "story-protocol-ip": [
        "create_dispute",
        "pay_royalty",
        "claim_all_royalties",
      ],
      "monitoring-compliance": [
        "get_similar_projects",
        "search_similar_projects",
      ],
    };

    return capabilities[agentType as keyof typeof capabilities] || [];
  }

  private async handleComplexAgentRequest(
    agentType: string,
    action: string,
    payload: any,
    projectId: string,
    res: any
  ) {
    const workflowId = uuidv4();

    // Create a complex action plan for the orchestrator to handle
    const complexPrompt = `The user wants to ${action} using the ${agentType} agent, but this requires coordination with other agents. Payload: ${JSON.stringify(
      payload
    )}`;

    const project = await this.getProject(projectId);
    const actionPlan = await this.analyzePromptAndCreateActionPlan(
      complexPrompt,
      project
    );

    if (actionPlan.type === "COMPLEX_ACTION") {
      await this.executeActionPlan(actionPlan, workflowId, project);
    }

    res.json({
      success: true,
      workflowId,
      message: `Complex request forwarded to orchestrator`,
      actionPlan:
        actionPlan.type === "COMPLEX_ACTION"
          ? actionPlan.description
          : "Processing...",
      status: "ORCHESTRATING",
    });
  }

  // =============================================================================
  // AGENT COMMUNICATION WITH CHARACTER CONTEXT
  // =============================================================================

  private async sendTaskToAgent(agentName: string, task: any): Promise<void> {
    const project = task.payload?.projectId
      ? await this.getProject(task.payload.projectId)
      : null;
    const characterContext = project
      ? this.getCharacterContext(project.side)
      : null;

    // Add character information to the task
    if (characterContext) {
      task.characterInfo = {
        side: project.side,
        agentCharacter: this.getAgentCharacter(agentName, characterContext),
        orchestratorCharacter: characterContext.orchestrator,
      };
    }

    const queueUrl = this.getAgentQueueUrl(agentName);

    console.log(
      `📤 Orchestrator: Sending task ${task.taskId} to ${agentName} ${
        task.characterInfo?.agentCharacter?.name || ""
      }`
    );

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
        CharacterSide: {
          DataType: "String",
          StringValue: project?.side || "light",
        },
      },
    });

    await this.sqsClient.send(command);

    // Store task status with character info
    await this.storeTaskStatus({
      taskId: task.taskId,
      workflowId: task.workflowId,
      status: "PENDING",
      agent: agentName,
      characterAgent: task.characterInfo?.agentCharacter?.name,
      startTime: new Date().toISOString(),
    });
  }

  private async sendSyncTaskToAgent(
    agentName: string,
    task: any
  ): Promise<any> {
    // For synchronous operations, send task and wait for result
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

  // =============================================================================
  // WORKFLOW MANAGEMENT WITH CHARACTER CONTEXT
  // =============================================================================

  private async getWorkflowTasks(workflowId: string): Promise<any[]> {
    const tableName = process.env.TASK_STATUS_TABLE || "orchestrator-tasks";

    const command = new QueryCommand({
      TableName: tableName,
      IndexName: "workflowId-index",
      KeyConditionExpression: "workflowId = :workflowId",
      ExpressionAttributeValues: marshall({
        ":workflowId": workflowId,
      }),
    });

    const response = await this.dynamoClient.send(command);
    return (response.Items || []).map((item) => unmarshall(item));
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private generateProjectId(repoUrl: string): string {
    const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "project";
    return `${repoName.toLowerCase()}-${Date.now()}`;
  }

  private extractKeywords(
    description: string,
    technicalDescription?: string
  ): string[] {
    const text = `${description} ${technicalDescription || ""}`.toLowerCase();
    const commonWords = [
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
    ];

    return text
      .split(/\s+/)
      .filter((word) => word.length > 3 && !commonWords.includes(word))
      .slice(0, 10);
  }

  private async updateProject(projectId: string, updates: any): Promise<void> {
    const tableName = process.env.PROJECTS_TABLE_NAME || "projects";

    const updateExpression: string[] = [];
    const expressionAttributeValues: any = {};

    Object.keys(updates).forEach((key) => {
      updateExpression.push(`${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = updates[key];
    });

    await this.dynamoClient.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: marshall({ projectId }),
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
      })
    );
  }

  private async getProject(projectId: string): Promise<any> {
    const tableName = process.env.PROJECTS_TABLE_NAME || "projects";

    const response = await this.dynamoClient.send(
      new GetItemCommand({
        TableName: tableName,
        Key: marshall({ projectId }),
      })
    );

    return response.Item ? unmarshall(response.Item) : null;
  }

  // =============================================================================
  // LEGACY WORKFLOW HANDLERS (keeping for backward compatibility)
  // =============================================================================

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
  }

  // =============================================================================
  // MESSAGE PROCESSING
  // =============================================================================

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
        `📋 New Project Creation: POST http://localhost:${port}/api/projects/create`
      );
      console.log(
        `📝 Setup Project Info: POST http://localhost:${port}/api/projects/:id/setup-info`
      );
      console.log(
        `🔧 Setup Agents: POST http://localhost:${port}/api/projects/:id/setup-agent/:type`
      );
      console.log(
        `💬 Interact with Agents: POST http://localhost:${port}/api/projects/:id/interact`
      );
      console.log(
        `📡 GitHub webhook: http://localhost:${port}/webhooks/github`
      );
      console.log(`📋 Health check: http://localhost:${port}/health`);
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
    const tableName = process.env.WORKFLOWS_TABLE || "orchestrator-workflows";

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
