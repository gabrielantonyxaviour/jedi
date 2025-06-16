import express from "express";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { fetchLogs, pushLogs } from "../services/nillion"; // Import Nillion functions
import { Scraper } from "agent-twitter-client";
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
    | "ANALYZE_AND_SETUP_PROJECT"
    | "PROJECT_INFO_SETUP"
    | "INTERACTIVE_ACTION";
  payload: any;
  userId: string;
  workflowId: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  projectId: string;
}

interface TaskStatus {
  taskId: string;
  workflowId: string;
  projectId: string;
  ownerAddress: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  agent: string;
  characterAgent?: string;
  startTime: string;
  endTime?: string;
  result?: any;
  error?: string;
}

export class CoreOrchestratorAgent {
  private openai: OpenAI;
  private app: express.Application;
  private clientWebhooks: string[] = [];
  private isRunning = false;
  private processedLogs: Set<string> = new Set();
  private pollInterval: number = 3000; // Poll every 3 seconds

  // In-memory storage for Nillion (replace DynamoDB)
  private workflows: Map<string, any> = new Map();
  private tasks: Map<string, TaskStatus> = new Map();
  private projects: Map<string, any> = new Map();
  private billing: Map<string, any> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.MY_OPENAI_KEY,
    });
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    console.log("🎯 Core Orchestrator Agent initialized with Nillion storage");
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
        const projectId = uuidv4();
        const characterContext = this.getCharacterContext(side);

        console.log(
          `🎯 Creating new ${side} side project from ${repoUrl} for ${walletAddress}`
        );

        // Step 1: Analyze GitHub repo and extract project info
        await this.sendTaskToAgent("github-intelligence", {
          taskId: uuidv4(),
          workflowId,
          type: "ANALYZE_AND_SETUP_PROJECT",
          payload: {
            repoUrl,
            projectId,
            side,
            ownerAddress: walletAddress,
            characterInfo: characterContext.github,
            extractProjectInfo: true,
          },
          priority: "HIGH",
        });

        console.log("🔍 Github analysis task sent");
        console.log("🔍 Storing workflow");

        // Store initial project workflow
        await this.storeWorkflow({
          type: "ANALYZE_AND_SETUP_PROJECT",
          workflowId,
          userId: walletAddress,
          projectId: projectId,
          priority: "HIGH",
          payload: {
            projectId,
            repoUrl,
            ownerAddress: walletAddress,
            side,
            step: "github_analysis",
          },
        });

        console.log("🔍 Workflow stored");
        console.log("🔍 Generating orchestrator response");

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
          status: "ANALYZING_REPOSITORY",
          nextStep: "setup_basic_info",
        });
      } catch (error: any) {
        console.error("🚨 Project creation failed:", error);
        res.status(500).json({
          error: "Failed to create project",
          details: error.message,
        });
      }
    });

    this.app.get("/api/tweet", async (req: any, res: any) => {
      const scraper = new Scraper();
      const tweetText = `🚀 Just took over the Jedi AI Framework - a TypeScript chat system where agent servers do the heavy lifting so humans can just... chat 

      5.8MB of "how hard could real-time messaging be?" energy ⚡
      
      Welcome to the repo where we're basically building Slack but with more lightsabers 🗡️
      
      #TypeScript #AI #OpenSource`;

      await scraper.login(
        process.env.TWITTER_USERNAME!,
        process.env.TWITTER_PASSWORD!,
        process.env.TWITTER_EMAIL
      );
      const result = await scraper.sendTweet(tweetText, undefined, undefined);
      console.log(result);
      const responseData = await result.json();
      res.json({
        tweet: result,
        url: `https://twitter.com/${process.env.TWITTER_USERNAME}/status/${responseData.id}`,
      });
    });

    // 2. Setup basic project info
    this.app.post(
      "/api/projects/:projectId/setup-info",
      async (req: any, res: any) => {
        try {
          const { projectId } = req.params;
          const { name, description, technicalDescription, imageUrl } =
            req.body;

          console.log(
            `[Setup Info] Request received for project ${projectId}:`,
            {
              name,
              description,
              technicalDescription,
              imageUrl,
            }
          );

          const workflowId = uuidv4();
          const project = await this.getProject(projectId);

          if (!project) {
            console.log(`[Setup Info] Project ${projectId} not found`);
            return res.status(404).json({ error: "Project not found" });
          }

          console.log(`[Setup Info] Found project:`, project);

          // Update project info
          const updates = {
            name,
            description,
            ownerAddress: project.ownerAddress,
            technicalDescription,
            imageUrl,
            updatedAt: new Date().toISOString(),
          };
          console.log(`[Setup Info] Updating project with:`, updates);
          await this.updateProject(projectId, updates);

          // Update project state
          console.log(`[Setup Info] Updating project state to SETUP`);
          await this.updateProjectInitState(projectId, "SETUP");

          // Trigger lead discovery
          const leadTask = {
            taskId: uuidv4(),
            workflowId,
            type: "PROJECT_CREATED_LEADS_SEARCH",
            payload: {
              projectId,
              projectName: name,
              ownerAddress: project.ownerAddress,
              description,
              technicalDescription,
              keywords: this.extractKeywords(description, technicalDescription),
              sources: ["all"],
              maxResults: 50,
            },
            priority: "MEDIUM",
          };
          console.log(`[Setup Info] Sending lead generation task:`, leadTask);
          await this.sendTaskToAgent("lead-generation", leadTask);

          const workflow: WorkflowRequest = {
            type: "PROJECT_INFO_SETUP",
            workflowId,
            userId: project.ownerAddress,
            projectId: projectId,
            priority: "MEDIUM",
            payload: {
              projectId,
              step: "lead_discovery",
              ownerAddress: project.ownerAddress,
            },
          };
          console.log(`[Setup Info] Storing workflow:`, workflow);
          await this.storeWorkflow(workflow);

          const orchestratorResponse =
            project.side === "light"
              ? "Wise choices you have made. Discover potential allies, Chewbacca will. Patience you must have."
              : "Your project grows stronger. Count Dooku will hunt for business opportunities. The Empire demands results.";

          console.log(
            `[Setup Info] Sending response with status DISCOVERING_LEADS`
          );
          res.json({
            success: true,
            projectId,
            workflowId,
            message: "Project info updated and lead discovery initiated",
            characterResponse: orchestratorResponse,
            status: "DISCOVERING_LEADS",
            nextStep: "setup_agents",
          });
        } catch (error: any) {
          console.error("[Setup Info] Failed:", error);
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
          const {
            twitter,
            linkedin,
            telegram,
            autoPost,
            character,
            postsPerDay,
          } = req.body;

          const workflowId = uuidv4();
          const project = await this.getProject(projectId);

          if (!project) {
            return res.status(404).json({ error: "Project not found" });
          }

          console.log(`🔧 Setting up socials for project ${projectId}`);

          let setupResult;
          let characterResponse = "";
          setupResult = await this.setupSocialsAgent(
            project,
            { twitter, linkedin, telegram },
            autoPost,
            character,
            postsPerDay,
            workflowId
          );

          // Update project state
          await this.updateProjectInitState(projectId, "SOCIALS");

          characterResponse =
            project.side === "light"
              ? "Ready for social engagement, Ahsoka Tano is. Spread your message across the galaxy, she will."
              : "Savage Opress will dominate the social channels. Fear and respect, our tools they are.";

          res.json({
            success: true,
            projectId,
            agentType: "socials",
            workflowId,
            characterResponse,
            message: `Socials agent setup initiated`,
            status: "SETTING_UP_SOCIALS",
            setupResult,
          });
        } catch (error: any) {
          console.error(
            `🚨 ${req.params.agentType} agent setup failed:`,
            error
          );
          res.status(500).json({
            error: `Failed to setup ${req.params.agentType} agent`,
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
          const {
            title,
            description,
            imageURL,
            ownerAddress,
            ownerPkey,
            members,
            membersPKey,
            userEmail,
            userName,
          } = req.body;

          const workflowId = uuidv4();
          const project = await this.getProject(projectId);

          if (!project) {
            return res.status(404).json({ error: "Project not found" });
          }
          project.name = title;
          project.description = description;
          project.imageUrl = imageURL;

          console.log(`🔧 Setting up karma for project ${projectId}`);

          let setupResult;
          let characterResponse = "";
          setupResult = await this.setupKarmaAgent(
            project,
            {
              ownerAddress,
              ownerPkey,
              members,
              membersPKey,
              userEmail,
              userName,
            },
            workflowId
          );

          // Update project state
          await this.updateProjectInitState(projectId, "KARMA");

          characterResponse =
            project.side === "light"
              ? "Ready for social engagement, Ahsoka Tano is. Spread your message across the galaxy, she will."
              : "Savage Opress will dominate the social channels. Fear and respect, our tools they are.";

          res.json({
            success: true,
            projectId,
            agentType: "karma",
            workflowId,
            characterResponse,
            message: `Karma agent setup initiated`,
            status: "SETTING_UP_KARMA",
            setupResult,
          });
        } catch (error: any) {
          console.error(
            `🚨 ${req.params.agentType} agent setup failed:`,
            error
          );
          res.status(500).json({
            error: `Failed to setup ${req.params.agentType} agent`,
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
          const { title, description, imageURL, remixFee, commercialRevShare } =
            req.body;

          console.log(`[IP Setup] Starting IP setup for project ${projectId}`);
          console.log(`[IP Setup] Request body:`, {
            title,
            description,
            imageURL,
            remixFee,
            commercialRevShare,
          });

          const workflowId = uuidv4();
          console.log(`[IP Setup] Generated workflow ID: ${workflowId}`);

          const project = await this.getProject(projectId);
          console.log(`[IP Setup] Retrieved project:`, project);

          if (!project) {
            console.log(`[IP Setup] Project ${projectId} not found`);
            return res.status(404).json({ error: "Project not found" });
          }

          // Validate required fields
          if (!title || !description) {
            console.log(`[IP Setup] Missing required fields:`, {
              title,
              description,
            });
            return res.status(400).json({
              error: "Title and description are required",
            });
          }

          // Set defaults for missing values
          const finalRemixFee = "1"; // Default remix fee
          const finalCommercialRevShare = "10"; // Default 10%
          console.log(`[IP Setup] Using values:`, {
            finalRemixFee,
            finalCommercialRevShare,
          });

          project.name = title;
          project.description = description;
          project.imageUrl = imageURL;
          console.log(`[IP Setup] Updated project with new values:`, {
            name: project.name,
            description: project.description,
            imageUrl: project.imageUrl,
          });

          console.log(`🔧 Setting up IP for project ${projectId}`);

          let setupResult;
          let characterResponse = "";
          console.log(
            `[IP Setup] Calling setupIPAgent with workflow ID: ${workflowId}`
          );
          setupResult = await this.setupIPAgent(
            project,
            {
              title,
              description,
              imageURL,
              license: "MIT",
              licenseTermsData: [finalCommercialRevShare, finalRemixFee],
            },
            workflowId
          );
          console.log(`[IP Setup] IP agent setup completed:`, setupResult);

          // Update project state
          console.log(`[IP Setup] Updating project state to IP`);
          await this.updateProjectInitState(projectId, "IP");

          characterResponse =
            project.side === "light"
              ? "Protect your intellectual property, we will. Strong with the Force, your code shall be."
              : "Your IP dominance is secured. Those who steal will face the power of the dark side.";
          console.log(
            `[IP Setup] Generated character response: ${characterResponse}`
          );

          console.log(`[IP Setup] Sending success response`);
          res.json({
            success: true,
            projectId,
            agentType: "ip",
            workflowId,
            characterResponse,
            message: `IP agent setup initiated`,
            status: "SETTING_UP_IP",
            setupResult,
          });
        } catch (error: any) {
          console.error(`🚨 IP agent setup failed:`, error);
          console.error(`[IP Setup] Error details:`, error.stack);
          res.status(500).json({
            error: `Failed to setup IP agent`,
            details: error.message,
          });
        }
      }
    );

    // 6. Interactive agent communication with character responses
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
        const { repoUrl, userId = "anonymous", projectId } = req.body;

        if (!repoUrl) {
          return res.status(400).json({ error: "repoUrl is required" });
        }

        if (!projectId) {
          return res
            .status(400)
            .json({ error: "projectId is required for billing" });
        }

        const workflowId = uuidv4();

        console.log(
          `🎯 Orchestrator: Starting GitHub analysis workflow for ${repoUrl} (${projectId})`
        );

        // Record credit consumption
        await this.recordGitHubAnalysis(projectId, repoUrl, workflowId);

        // Create workflow
        const workflow: WorkflowRequest = {
          type: "GITHUB_ANALYSIS",
          workflowId,
          userId,
          projectId: projectId,
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
          projectId: projectId,
        });

        // Store workflow
        await this.storeWorkflow(workflow);

        res.json({
          success: true,
          workflowId,
          projectId,
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
    // BILLING & FINANCIAL ENDPOINTS
    // =============================================================================

    // Get financial information for a project
    this.app.get(
      "/api/billing/:projectKey/financials",
      async (req: any, res: any) => {
        try {
          const { projectKey } = req.params;

          console.log(`💰 Orchestrator: Getting financials for ${projectKey}`);

          // Get project financials from in-memory storage
          const financials = this.billing.get(projectKey) || {
            totalDue: 0,
            totalOverallUsed: 0,
            totalOverallPaid: 0,
            creditBalance: 100, // Default credits
            status: "active",
            lastUpdated: new Date().toISOString(),
          };

          const response = {
            totalDue: financials.totalDue,
            totalOverallUsed: financials.totalOverallUsed,
            totalOverallPaid: financials.totalOverallPaid,
            creditBalance: financials.creditBalance,
            status: financials.status,
            lastUpdated: financials.lastUpdated,
            payments: financials.payments || [],
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
        version: "3.0.0-nillion",
        storage: "nillion",
        processedLogs: this.processedLogs.size,
        isPolling: this.isRunning,
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
    const links = this.extractSocialLinks(project);
    await this.sendTaskToAgent("karma-integration", {
      taskId: uuidv4(),
      workflowId,
      type: "CREATE_KARMA_PROJECT",
      payload: {
        projectId: project.projectId,
        title: project.name,
        description: project.description,
        imageURL: project.imageUrl,
        links: links,
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

  private extractSocialLinks(
    project: any
  ): Array<{ type: string; url: string }> {
    const links: Array<{ type: string; url: string }> = [];

    // Check if project has social config
    if (!project.socialConfig?.socials) {
      return links;
    }

    const socials = project.socialConfig.socials;

    // Extract Twitter/X link
    if (socials.twitter && !socials.twitter.NULL && socials.twitter.username) {
      links.push({
        type: "twitter",
        url: `https://twitter.com/${socials.twitter.username}`,
      });
    }

    // Extract LinkedIn link
    if (socials.linkedin && !socials.linkedin.NULL) {
      // LinkedIn might have different structure, adjust as needed
      if (socials.linkedin.username) {
        links.push({
          type: "linkedin",
          url: `https://linkedin.com/in/${socials.linkedin.username}`,
        });
      } else if (socials.linkedin.url) {
        links.push({
          type: "linkedin",
          url: socials.linkedin.url,
        });
      }
    }

    // Extract Telegram link
    if (socials.telegram && !socials.telegram.NULL) {
      if (socials.telegram.username) {
        links.push({
          type: "telegram",
          url: `https://t.me/${socials.telegram.username}`,
        });
      } else if (socials.telegram.url) {
        links.push({
          type: "telegram",
          url: socials.telegram.url,
        });
      }
    }

    // Add GitHub link if available
    if (project.githubUrl) {
      links.push({
        type: "github",
        url: project.githubUrl,
      });
    }

    return links;
  }

  private async setupIPAgent(project: any, config: any, workflowId: string) {
    console.log(
      `[IP Agent Setup] Starting setup for project ${project.projectId}`
    );

    // Setup both Story Protocol IP and Compliance monitoring
    const ipTaskId = uuidv4();
    const complianceTaskId = uuidv4();
    console.log(`[IP Agent Setup] Generated task IDs:`, {
      ipTaskId,
      complianceTaskId,
    });

    const randomAddress = `0x${Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}`;
    console.log(`[IP Agent Setup] Generated random address: ${randomAddress}`);

    const developers = project.developers.map((developer: any) => ({
      name: developer.name,
      githubUsername: developer.name,
      walletAddress: randomAddress,
      contributionPercent: 100 / project.developers.length,
    }));
    console.log(`[IP Agent Setup] Processed developers:`, developers);

    // Setup IP protection
    console.log(
      `[IP Agent Setup] Sending IP registration task to blockchain-ip agent`
    );

    await this.sendTaskToAgent("blockchain-ip", {
      taskId: ipTaskId,
      workflowId,
      type: "REGISTER_GITHUB_PROJECT",
      payload: {
        projectId: project.projectId,
        ownerAddress: project.ownerAddress,
        title: project.name,
        description: project.description,
        logoUrl: project.imageUrl,
        repositoryUrl:
          "https://github.com/" +
          project.developers[0].name +
          "/" +
          project.projectId.split("-")[0],
        developers,
        license: config.license || "MIT",
        programmingLanguages: project.languages || ["JavaScript"],
        licenseTermsData: config.licenseTermsData || [],
        characterName: this.getCharacterContext(project.side).ip.name,
      },
      priority: "HIGH",
    });
    console.log(`[IP Agent Setup] IP registration task sent successfully`);

    // Setup compliance monitoring
    console.log(`[IP Agent Setup] Sending compliance monitoring task`);
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
    console.log(
      `[IP Agent Setup] Compliance monitoring task sent successfully`
    );

    console.log(`[IP Agent Setup] Setup completed successfully`);
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
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1200,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      return JSON.parse(content);
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
      projectId: project.projectId,
      userId: "user",
      priority: "HIGH",
      payload: {
        projectId: project.projectId,
        ownerAddress: project.ownerAddress,
        actionPlan,
        status: "executing",
      },
    });
  }

  // =============================================================================
  // NILLION TASK COMMUNICATION (Replaces SQS)
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

    console.log(
      `📤 Orchestrator: Sending task ${task.taskId} to ${agentName} ${
        task.characterInfo?.agentCharacter?.name || ""
      }`
    );

    // Store task status with character info
    await this.storeTaskStatus({
      taskId: task.taskId,
      workflowId: task.workflowId,
      ownerAddress: task.payload.ownerAddress,
      projectId: task.payload.projectId,
      status: "PENDING",
      agent: agentName,
      startTime: new Date().toISOString(),
    });

    // Send task via Nillion logs instead of SQS
    try {
      await pushLogs({
        id: task.taskId,
        owner_address: task.payload.ownerAddress,
        project_id: task.payload.projectId,
        agent_name: agentName,
        text: `Task assignment: ${task.type} for ${task.taskId}`,
        data: JSON.stringify(task),
      });
      console.log(`✅ Task ${task.taskId} sent to ${agentName} via Nillion`);
    } catch (error) {
      console.error(
        `❌ Failed to send task ${task.taskId} to ${agentName}:`,
        error
      );
      throw error;
    }
  }

  // =============================================================================
  // NILLION POLLING (Replaces SQS Listener)
  // =============================================================================

  public async startTaskCompletionListener() {
    console.log("📡 Starting Nillion task completion listener...");
    this.isRunning = true;
    await this.pollNillionForCompletions();
  }

  private async pollNillionForCompletions() {
    while (this.isRunning) {
      try {
        await this.checkForTaskCompletions();
        await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      } catch (error) {
        console.error("❌ Error polling Nillion for completions:", error);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
  }

  private async checkForTaskCompletions() {
    try {
      const allLogs = await fetchLogs();

      // Filter logs for task completions meant for orchestrator
      const completionLogs = allLogs.filter((log) => {
        if (this.processedLogs.has(log.id || "")) {
          return false; // Already processed
        }

        return (
          log.agent_name === "orchestrator" && this.isTaskCompletion(log.data)
        );
      });

      console.log("🔍 Completion logs:", completionLogs);

      if (completionLogs.length > 0) {
        console.log(`📨 Found ${completionLogs.length} task completion(s)`);

        for (const log of completionLogs) {
          await this.processCompletionFromLog(log);
          this.processedLogs.add(log.id || "");
        }
      }

      // Clean up old processed log IDs
      if (this.processedLogs.size > 1000) {
        const logsArray = Array.from(this.processedLogs);
        this.processedLogs.clear();
        logsArray.slice(-500).forEach((id) => this.processedLogs.add(id));
      }
    } catch (error) {
      console.error("❌ Error checking for task completions:", error);
      throw error;
    }
  }

  private isTaskCompletion(dataString: string): boolean {
    try {
      const data = JSON.parse(dataString);
      return data.type === "TASK_COMPLETION" && data.payload?.taskId;
    } catch {
      return false;
    }
  }

  private async processCompletionFromLog(log: any) {
    try {
      console.log(`🔍 Processing task completion log: ${log.id}`);

      let completion;
      try {
        const data = JSON.parse(log.data);
        completion = data.type === "TASK_COMPLETION" ? data.payload : data;
      } catch (parseError) {
        console.log("⚠️ Could not parse completion from log data");
        return;
      }

      if (!completion.taskId) {
        console.log("❌ Invalid completion: no taskId", completion);
        return;
      }

      // Update task status in memory
      await this.updateTaskStatus(completion.taskId, {
        status: completion.status,
        endTime: completion.timestamp,
        result: completion.result,
        error: completion.error,
      });

      const workflow = await this.getWorkflow(completion.workflowId);

      if (workflow) {
        // Update project state after GitHub analysis
        if (
          workflow.type === "ANALYZE_AND_SETUP_PROJECT" &&
          completion.agent === "github-intelligence"
        ) {
          await this.updateProjectInitState(
            workflow.payload.projectId,
            "SETUP"
          );
        }

        // Handle multi-step Karma workflows
        // await this.handleKarmaWorkflowStep(completion, workflow);

        const isComplete = await this.checkWorkflowCompletion(
          completion.workflowId
        );

        if (isComplete) {
          console.log(
            `✅ Orchestrator: Completing workflow ${completion.workflowId}`
          );
          await this.completeWorkflow(completion.workflowId);
        }

        // // Notify client
        // await this.notifyClient(completion.workflowId, {
        //   type: "TASK_COMPLETED",
        //   taskId: completion.taskId,
        //   workflowId: completion.workflowId,
        //   agent: completion.agent,
        //   status: completion.status,
        //   result: completion.result,
        //   error: completion.error,
        // });
      }

      console.log(`✅ Processed completion for task ${completion.taskId}`);
    } catch (error) {
      console.error(`❌ Error processing completion log ${log.id}:`, error);
    }
  }

  // =============================================================================
  // NILLION DATA MANAGEMENT (Replaces DynamoDB)
  // =============================================================================

  private async storeWorkflow(workflow: WorkflowRequest): Promise<void> {
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

    console.log(
      `[Orchestrator] Storing workflow in memory:`,
      JSON.stringify(item, null, 2)
    );

    // Store in memory and also push to Nillion for persistence
    this.workflows.set(workflow.workflowId, item);

    try {
      await pushLogs({
        id: uuidv4(),
        owner_address: workflow.payload.ownerAddress,
        project_id: workflow.projectId,
        agent_name: "orchestrator",
        text: `Workflow created: ${workflow.type}`,
        data: JSON.stringify(item),
      });
    } catch (error) {
      console.error("❌ Failed to store workflow in Nillion:", error);
    }
  }

  private async getWorkflow(workflowId: string): Promise<any> {
    return this.workflows.get(workflowId) || null;
  }

  private async storeTaskStatus(status: TaskStatus): Promise<void> {
    console.log(
      `[Orchestrator] Storing task status in memory:`,
      JSON.stringify(status, null, 2)
    );

    this.tasks.set(status.taskId, status);
    this.tasks.set(status.workflowId, status);

    try {
      await pushLogs({
        id: status.taskId,
        owner_address: status.ownerAddress,
        project_id: status.projectId,
        agent_name: "orchestrator",
        text: `Task status update: ${status.taskId} - ${status.status}`,
        data: JSON.stringify(status),
      });
    } catch (error) {
      console.error("❌ Failed to store task status in Nillion:", error);
    }
  }

  private async updateProject(projectId: string, updates: any): Promise<void> {
    const existing = this.projects.get(projectId) || {};
    const updated = { ...existing, ...updates };

    console.log(`[Orchestrator] Updating project in memory:`, {
      projectId,
      updates: JSON.stringify(updates, null, 2),
    });

    this.projects.set(projectId, updated);

    try {
      await pushLogs({
        id: uuidv4(),
        owner_address: updates.ownerAddress,
        project_id: projectId,
        agent_name: "orchestrator",
        text: `Project updated: ${projectId}`,
        data: JSON.stringify(updated),
      });
    } catch (error) {
      console.error("❌ Failed to update project in Nillion:", error);
    }
  }

  private async getProject(projectId: string): Promise<any> {
    return this.projects.get(projectId) || null;
  }

  private async updateProjectInitState(
    projectId: string,
    state: string
  ): Promise<void> {
    const project = this.projects.get(projectId);
    if (project) {
      project.initState = state;
      project.updatedAt = new Date().toISOString();
      this.projects.set(projectId, project);

      try {
        await pushLogs({
          id: uuidv4(),
          owner_address: project.owner,
          project_id: projectId,
          agent_name: "orchestrator",
          text: `Project state updated: ${projectId} - ${state}`,
          data: JSON.stringify(project),
        });
      } catch (error) {
        console.error("❌ Failed to update project state in Nillion:", error);
      }
    }
  }

  private async getWorkflowTasks(workflowId: string): Promise<any[]> {
    const tasks: any[] = [];
    for (const [taskId, task] of this.tasks) {
      if (task.workflowId === workflowId) {
        tasks.push(task);
      }
    }
    return tasks;
  }

  private async updateTaskStatus(taskId: string, updates: Partial<TaskStatus>) {
    const existing = this.tasks.get(taskId);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.tasks.set(taskId, updated);

      console.log(`[Orchestrator] Updated task status in memory:`, {
        taskId,
        updates: JSON.stringify(updates, null, 2),
      });

      try {
        await pushLogs({
          id: uuidv4(),
          owner_address: "orchestrator",
          project_id: updated.workflowId,
          agent_name: "orchestrator",
          text: `Task status updated: ${taskId} - ${updated.status}`,
          data: JSON.stringify(updated),
        });
      } catch (error) {
        console.error("❌ Failed to update task status in Nillion:", error);
      }
    }
  }

  private async checkWorkflowCompletion(workflowId: string): Promise<boolean> {
    const tasks = await this.getWorkflowTasks(workflowId);
    return tasks.every(
      (task) => task.status === "COMPLETED" || task.status === "FAILED"
    );
  }

  private async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      workflow.status = "COMPLETED";
      workflow.completedAt = new Date().toISOString();
      this.workflows.set(workflowId, workflow);

      try {
        await pushLogs({
          id: uuidv4(),
          owner_address: "orchestrator",
          project_id: workflowId,
          agent_name: "orchestrator",
          text: `Workflow completed: ${workflowId}`,
          data: JSON.stringify(workflow),
        });
      } catch (error) {
        console.error("❌ Failed to complete workflow in Nillion:", error);
      }
    }
  }

  // =============================================================================
  // LEGACY BILLING METHODS (Simplified)
  // =============================================================================

  private async recordGitHubAnalysis(
    projectKey: string,
    repoUrl: string,
    workflowId: string
  ) {
    const billing = this.billing.get(projectKey) || {
      totalDue: 0,
      totalOverallUsed: 0,
      totalOverallPaid: 0,
      creditBalance: 100,
      status: "active",
      lastUpdated: new Date().toISOString(),
      payments: [],
    };

    billing.totalOverallUsed += 5; // $5 for GitHub analysis
    billing.totalDue += 5;
    billing.creditBalance -= 5;
    billing.lastUpdated = new Date().toISOString();

    this.billing.set(projectKey, billing);
    console.log(`💰 Recorded GitHub analysis billing for ${projectKey}: $5`);
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
    return this.tasks.get(taskId) || null;
  }

  private async getAgentStatus(): Promise<any> {
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

  private async handleKarmaWorkflowStep(
    completion: any,
    workflow: any
  ): Promise<void> {
    // Simplified karma workflow handling for Nillion
    if (
      completion.agent !== "karma-integration" ||
      completion.status !== "COMPLETED"
    ) {
      return;
    }

    console.log(`🔄 Handling Karma workflow step for ${completion.taskId}`);
    // Add your karma workflow logic here
  }

  private async getTaskDetails(taskId: string): Promise<any> {
    return this.tasks.get(taskId) || null;
  }

  private async notifyClient(workflowId: string, notification: any) {
    // Send webhook to registered client endpoints
    try {
      await fetch("http://localhost:3001/agents/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          timestamp: new Date().toISOString(),
          ...notification,
        }),
      });
    } catch (error) {
      console.error(
        `Failed to notify client webhook ${"http://localhost:3001/agents/callback"}:`,
        error
      );
    }
  }

  // =============================================================================
  // SERVER MANAGEMENT
  // =============================================================================

  public start(port: number = 3000): void {
    this.startTaskCompletionListener();

    this.app.listen(port, () => {
      console.log(
        `🎯 Core Orchestrator Agent running on port ${port} (Nillion Mode)`
      );
      console.log(
        `📋 New Project Creation: POST http://localhost:${port}/api/projects/create`
      );
      console.log(
        `📝 Setup Project Info: POST http://localhost:${port}/api/projects/:id/setup-info`
      );
      console.log(
        `🔧 Setup Agents: POST http://localhost:${port}/api/projects/:id/setup-*`
      );
      console.log(
        `💬 Interact with Agents: POST http://localhost:${port}/api/projects/:id/interact`
      );
      console.log(
        `📡 GitHub webhook: http://localhost:${port}/webhooks/github`
      );
      console.log(`📋 Health check: http://localhost:${port}/health`);
      console.log(`📊 Storage: Nillion (In-Memory + Logs)`);
      console.log(`📡 Agent Communication: Nillion Logs`);
    });
  }

  public async stop(): Promise<void> {
    console.log("🛑 Stopping Core Orchestrator Agent...");
    this.isRunning = false;
    console.log("✅ Core Orchestrator Agent stopped");
  }

  // Optional: Get status information
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      processedLogsCount: this.processedLogs.size,
      pollInterval: this.pollInterval,
      workflowsCount: this.workflows.size,
      tasksCount: this.tasks.size,
      projectsCount: this.projects.size,
      storage: "nillion",
      version: "3.0.0-nillion",
    };
  }
}

// Export and start
const orchestrator = new CoreOrchestratorAgent();

// Graceful shutdown handling
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  await orchestrator.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  await orchestrator.stop();
  process.exit(0);
});

// Start the server
orchestrator.start(3000);
