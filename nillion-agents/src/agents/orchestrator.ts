import express from "express";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import {
  fetchGithubByAddress,
  pushLogs,
  fetchLogs,
  fetchLogsByAddress,
} from "../services/nillion";
import { GithubData, LogsData } from "../types/nillion";

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
  private openai: OpenAI;
  private app: express.Application;
  private clientWebhooks: string[] = [];
  private isListening: boolean = false;
  private agentName: string = "core-orchestrator";

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.MY_OPENAI_KEY,
    });
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

    // 2. Setup basic project info
    this.app.post(
      "/api/projects/:projectId/setup-info",
      async (req: any, res: any) => {
        try {
          const { projectId } = req.params;
          const {
            name,
            description,
            technicalDescription,
            imageUrl,
            walletAddress,
          } = req.body;

          if (!walletAddress) {
            return res.status(400).json({ error: "walletAddress is required" });
          }

          console.log(
            `[Setup Info] Request received for project ${projectId}:`,
            {
              name,
              description,
              technicalDescription,
              imageUrl,
              walletAddress,
            }
          );

          const workflowId = uuidv4();
          const project = await this.getProject(projectId, walletAddress);

          if (!project) {
            console.log(`[Setup Info] Project ${projectId} not found`);
            return res.status(404).json({ error: "Project not found" });
          }

          console.log(`[Setup Info] Found project:`, project);

          // Update project info
          const updates = {
            name,
            description,
            technical_description: technicalDescription,
            image_url: imageUrl,
            updated_at: new Date().toISOString(),
          };
          console.log(`[Setup Info] Updating project with:`, updates);
          await this.updateProject(projectId, walletAddress, updates);

          // Update project state
          console.log(`[Setup Info] Updating project state to SETUP`);
          await this.updateProjectInitState(projectId, walletAddress, "SETUP");

          // Trigger lead discovery
          const leadTask = {
            taskId: uuidv4(),
            workflowId,
            type: "PROJECT_CREATED_LEADS_SEARCH",
            payload: {
              projectId,
              projectName: name,
              description,
              technicalDescription,
              ownerAddress: walletAddress,
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
            userId: walletAddress,
            priority: "MEDIUM",
            payload: { projectId, step: "lead_discovery" },
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
            walletAddress,
          } = req.body;

          if (!walletAddress) {
            return res.status(400).json({ error: "walletAddress is required" });
          }

          const workflowId = uuidv4();
          const project = await this.getProject(projectId, walletAddress);

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
            workflowId,
            walletAddress
          );

          // Update project state
          await this.updateProjectInitState(
            projectId,
            walletAddress,
            "SOCIALS"
          );

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
          console.error(`🚨 Socials agent setup failed:`, error);
          res.status(500).json({
            error: `Failed to setup socials agent`,
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

          if (!ownerAddress) {
            return res.status(400).json({ error: "ownerAddress is required" });
          }

          const workflowId = uuidv4();
          const project = await this.getProject(projectId, ownerAddress);

          if (!project) {
            return res.status(404).json({ error: "Project not found" });
          }

          // Update project with karma info
          await this.updateProject(projectId, ownerAddress, {
            name: title,
            description: description,
            image_url: imageURL,
          });

          console.log(`🔧 Setting up karma for project ${projectId}`);

          let setupResult;
          let characterResponse = "";
          setupResult = await this.setupKarmaAgent(
            { ...project, name: title, description, imageUrl: imageURL },
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
          await this.updateProjectInitState(projectId, ownerAddress, "KARMA");

          characterResponse =
            project.side === "light"
              ? "Ready for grants and opportunities, Luke Skywalker is. The Force will guide us to funding."
              : "Darth Vader will acquire the funding we require. Your lack of grants... disturbing it is.";

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
          console.error(`🚨 Karma agent setup failed:`, error);
          res.status(500).json({
            error: `Failed to setup karma agent`,
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
          const {
            title,
            description,
            imageURL,
            remixFee,
            commercialRevShare,
            walletAddress,
          } = req.body;

          if (!walletAddress) {
            return res.status(400).json({ error: "walletAddress is required" });
          }

          console.log(`[IP Setup] Starting IP setup for project ${projectId}`);

          const workflowId = uuidv4();
          const project = await this.getProject(projectId, walletAddress);

          if (!project) {
            console.log(`[IP Setup] Project ${projectId} not found`);
            return res.status(404).json({ error: "Project not found" });
          }

          // Validate required fields
          if (!title || !description) {
            return res.status(400).json({
              error: "Title and description are required",
            });
          }

          // Set defaults for missing values
          const finalRemixFee = remixFee || "1";
          const finalCommercialRevShare = commercialRevShare || "10";

          // Update project
          await this.updateProject(projectId, walletAddress, {
            name: title,
            description: description,
            image_url: imageURL,
          });

          console.log(`🔧 Setting up IP for project ${projectId}`);

          let setupResult;
          let characterResponse = "";
          setupResult = await this.setupIPAgent(
            { ...project, name: title, description, imageUrl: imageURL },
            {
              title,
              description,
              imageURL,
              license: "MIT",
              licenseTermsData: [finalCommercialRevShare, finalRemixFee],
            },
            workflowId,
            walletAddress
          );

          // Update project state
          await this.updateProjectInitState(projectId, walletAddress, "IP");

          characterResponse =
            project.side === "light"
              ? "Protect your intellectual property, we will. Strong with the Force, your code shall be."
              : "Your IP dominance is secured. Those who steal will face the power of the dark side.";

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
          const { prompt, walletAddress } = req.body;

          if (!prompt) {
            return res.status(400).json({ error: "prompt is required" });
          }

          if (!walletAddress) {
            return res.status(400).json({ error: "walletAddress is required" });
          }

          const workflowId = uuidv4();
          project = await this.getProject(projectId, walletAddress);

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
              project,
              walletAddress
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
    // GITHUB WEBHOOKS
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
            ownerAddress: "system", // System-level webhook
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
        const { walletAddress } = req.query;

        if (!walletAddress) {
          return res.status(400).json({ error: "walletAddress is required" });
        }

        const workflow = await this.getWorkflow(
          workflowId,
          walletAddress as string
        );

        if (!workflow) {
          return res.status(404).json({ error: "Workflow not found" });
        }

        // Get project to add character context
        const project = workflow.payload?.projectId
          ? await this.getProject(
              workflow.payload.projectId,
              walletAddress as string
            )
          : null;
        const characterContext = project
          ? this.getCharacterContext(project.side)
          : null;

        // Get all tasks for this workflow with character info
        const tasks = await this.getWorkflowTasks(
          workflowId,
          walletAddress as string
        );

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
    // SYSTEM ENDPOINTS
    // =============================================================================

    // Health check
    this.app.get("/health", (req: any, res: any) => {
      res.json({
        status: "healthy",
        service: "core-orchestrator",
        timestamp: new Date().toISOString(),
        version: "3.0.0-nillion",
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
    workflowId: string,
    ownerAddress: string
  ) {
    console.log(`🔧 Setting up socials for project ${project.project_id}`);

    await this.sendTaskToAgent("social-media", {
      taskId: uuidv4(),
      workflowId,
      type: "SETUP_SOCIAL",
      payload: {
        projectId: project.project_id,
        projectName: project.name,
        description: project.description,
        ownerAddress: ownerAddress,
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
        projectId: project.project_id,
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

    // Add GitHub link if available
    if (project.github_url) {
      links.push({
        type: "github",
        url: project.github_url,
      });
    }

    return links;
  }

  private async setupIPAgent(
    project: any,
    config: any,
    workflowId: string,
    ownerAddress: string
  ) {
    console.log(
      `[IP Agent Setup] Starting setup for project ${project.project_id}`
    );

    const ipTaskId = uuidv4();
    const complianceTaskId = uuidv4();

    const randomAddress = `0x${Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}`;

    const developers = project.contributors?.map((contributor: any) => ({
      name: contributor.username,
      githubUsername: contributor.username,
      walletAddress: randomAddress,
      contributionPercent: 100 / (project.contributors?.length || 1),
    })) || [
      {
        name: "developer",
        githubUsername: "developer",
        walletAddress: randomAddress,
        contributionPercent: 100,
      },
    ];

    // Setup IP protection
    await this.sendTaskToAgent("blockchain-ip", {
      taskId: ipTaskId,
      workflowId,
      type: "REGISTER_GITHUB_PROJECT",
      payload: {
        projectId: project.project_id,
        ownerId: ownerAddress,
        ownerAddress: ownerAddress,
        title: project.name,
        description: project.description,
        logoUrl: project.image_url,
        repositoryUrl: project.github_url,
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
        projectId: project.project_id,
        projectName: project.name,
        description: project.description,
        ownerAddress: ownerAddress,
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
- GitHub: ${project.github_url}

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
    project: any,
    ownerAddress: string
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
          projectId: project.project_id,
          ownerAddress: ownerAddress,
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
      userId: ownerAddress,
      priority: "HIGH",
      payload: {
        projectId: project.project_id,
        actionPlan,
        status: "executing",
      },
    });
  }

  // =============================================================================
  // AGENT COMMUNICATION WITH CHARACTER CONTEXT
  // =============================================================================

  private async sendTaskToAgent(agentName: string, task: any): Promise<void> {
    const project =
      task.payload?.projectId && task.payload?.ownerAddress
        ? await this.getProject(
            task.payload.projectId,
            task.payload.ownerAddress
          )
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

    // Store task using logs
    await pushLogs({
      owner_address: task.payload?.ownerAddress || "system",
      project_id: task.payload?.projectId || task.workflowId,
      agent_name: this.agentName,
      text: `Task sent to ${agentName}: ${task.type}`,
      data: JSON.stringify({
        type: "AGENT_TASK",
        targetAgent: agentName.replace("-", "_").split("_")[0], // Extract first part for routing
        task: task,
        priority: task.priority || "MEDIUM",
        timestamp: new Date().toISOString(),
      }),
    });

    // Store task status with character info
    await this.storeTaskStatus({
      taskId: task.taskId,
      workflowId: task.workflowId,
      status: "PENDING",
      agent: agentName,
      characterAgent: task.characterInfo?.agentCharacter?.name,
      startTime: new Date().toISOString(),
      ownerAddress: task.payload?.ownerAddress || "system",
    });
  }

  // =============================================================================
  // WORKFLOW MANAGEMENT WITH CHARACTER CONTEXT
  // =============================================================================

  private async getWorkflowTasks(
    workflowId: string,
    ownerAddress: string
  ): Promise<any[]> {
    const logs = await fetchLogsByAddress(ownerAddress);

    return logs
      .filter((log) => {
        try {
          const data = JSON.parse(log.data);
          return data.type === "TASK_STATUS" && data.workflowId === workflowId;
        } catch {
          return false;
        }
      })
      .map((log) => {
        const data = JSON.parse(log.data);
        return data.task;
      });
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

  private async updateProject(
    projectId: string,
    ownerAddress: string,
    updates: any
  ): Promise<void> {
    const projects = await fetchGithubByAddress(ownerAddress);
    const project = projects.find((p) => p.project_id === projectId);

    if (project) {
      const updatedProject = {
        ...project,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      await updateProjects(updatedProject);
    }
  }

  private async getProject(
    projectId: string,
    ownerAddress: string
  ): Promise<any> {
    const projects = await fetchGithubByAddress(ownerAddress);
    return projects.find((p) => p.project_id === projectId) || null;
  }

  private async updateProjectInitState(
    projectId: string,
    ownerAddress: string,
    state: string
  ): Promise<void> {
    await this.udpate(projectId, ownerAddress, {
      init_state: state,
      state_updated_at: new Date().toISOString(),
    });
  }

  // =============================================================================
  // DATA MANAGEMENT
  // =============================================================================

  private async storeWorkflow(workflow: WorkflowRequest): Promise<void> {
    await pushLogs({
      owner_address: workflow.userId,
      project_id: workflow.payload?.projectId || workflow.workflowId,
      agent_name: this.agentName,
      text: `Workflow ${workflow.type} started`,
      data: JSON.stringify({
        type: "WORKFLOW",
        workflowId: workflow.workflowId,
        workflowType: workflow.type,
        status: "ACTIVE",
        payload: workflow.payload,
        priority: workflow.priority,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });
  }

  private async getWorkflow(
    workflowId: string,
    ownerAddress: string
  ): Promise<any> {
    const logs = await fetchLogsByAddress(ownerAddress);

    const workflowLog = logs.find((log) => {
      try {
        const data = JSON.parse(log.data);
        return data.type === "WORKFLOW" && data.workflowId === workflowId;
      } catch {
        return false;
      }
    });

    if (workflowLog) {
      return JSON.parse(workflowLog.data);
    }

    return null;
  }

  private async storeTaskStatus(
    status: TaskStatus & { ownerAddress: string }
  ): Promise<void> {
    await pushLogs({
      owner_address: status.ownerAddress,
      project_id: status.workflowId,
      agent_name: this.agentName,
      text: `Task ${status.taskId} status: ${status.status}`,
      data: JSON.stringify({
        type: "TASK_STATUS",
        workflowId: status.workflowId,
        task: status,
        timestamp: new Date().toISOString(),
      }),
    });
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

  private async getTaskStatus(
    taskId: string,
    ownerAddress: string
  ): Promise<TaskStatus | null> {
    const logs = await fetchLogsByAddress(ownerAddress);

    const taskLog = logs.find((log) => {
      try {
        const data = JSON.parse(log.data);
        return data.type === "TASK_STATUS" && data.task?.taskId === taskId;
      } catch {
        return false;
      }
    });

    if (taskLog) {
      const data = JSON.parse(taskLog.data);
      return data.task;
    }

    return null;
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

  // =============================================================================
  // MESSAGE PROCESSING
  // =============================================================================

  private async processCompletionMessage(logData: any) {
    try {
      if (logData.type !== "TASK_COMPLETION") {
        return;
      }

      const completion = logData.payload || logData;

      if (!completion.taskId) {
        console.log("❌ Invalid completion: no taskId", completion);
        return;
      }

      // Update task status
      await this.updateTaskStatus(
        completion.taskId,
        completion.ownerAddress || "system",
        {
          status: completion.status,
          endTime: completion.timestamp,
          result: completion.result,
          error: completion.error,
        }
      );

      const workflow = await this.getWorkflow(
        completion.workflowId,
        completion.ownerAddress || "system"
      );

      if (workflow) {
        // Update project state after GitHub analysis
        if (
          workflow.workflowType === "PROJECT_CREATION" &&
          completion.agent === "github-intelligence"
        ) {
          await this.updateProjectInitState(
            workflow.payload.projectId,
            completion.ownerAddress || workflow.userId,
            "SETUP"
          );
        }

        const isComplete = await this.checkWorkflowCompletion(
          completion.workflowId,
          completion.ownerAddress || "system"
        );

        if (isComplete) {
          console.log(
            `✅ Orchestrator: Completing workflow ${completion.workflowId}`
          );
          await this.completeWorkflow(
            completion.workflowId,
            completion.ownerAddress || "system"
          );
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
    } catch (error) {
      console.error("❌ Error processing completion:", error);
    }
  }

  private async updateTaskStatus(
    taskId: string,
    ownerAddress: string,
    updates: Partial<TaskStatus>
  ) {
    const currentTask = await this.getTaskStatus(taskId, ownerAddress);

    if (currentTask) {
      const updatedTask = {
        ...currentTask,
        ...updates,
      };

      await pushLogs({
        owner_address: ownerAddress,
        project_id: currentTask.workflowId,
        agent_name: this.agentName,
        text: `Task ${taskId} updated: ${updates.status || currentTask.status}`,
        data: JSON.stringify({
          type: "TASK_STATUS",
          workflowId: currentTask.workflowId,
          task: updatedTask,
          timestamp: new Date().toISOString(),
        }),
      });
    }
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
      console.error(`Failed to notify client webhook:`, error);
    }
  }

  private async checkWorkflowCompletion(
    workflowId: string,
    ownerAddress: string
  ): Promise<boolean> {
    const tasks = await this.getWorkflowTasks(workflowId, ownerAddress);

    // Check if all tasks are completed
    return tasks.every(
      (task) => task.status === "COMPLETED" || task.status === "FAILED"
    );
  }

  private async completeWorkflow(
    workflowId: string,
    ownerAddress: string
  ): Promise<void> {
    await pushLogs({
      owner_address: ownerAddress,
      project_id: workflowId,
      agent_name: this.agentName,
      text: `Workflow ${workflowId} completed`,
      data: JSON.stringify({
        type: "WORKFLOW_COMPLETION",
        workflowId,
        status: "COMPLETED",
        completedAt: new Date().toISOString(),
      }),
    });
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
        `🔧 Setup Agents: POST http://localhost:${port}/api/projects/:id/setup-*`
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
    console.log("🎧 Starting task completion listener...");
    this.isListening = true;

    // Poll for task completions
    setInterval(async () => {
      if (!this.isListening) return;

      try {
        const allLogs = await fetchLogs();

        // Filter for task completion messages that haven't been processed
        const completionLogs = allLogs.filter((log) => {
          try {
            const data = JSON.parse(log.data);
            return data.type === "TASK_COMPLETION" && !data.processed;
          } catch {
            return false;
          }
        });

        for (const log of completionLogs) {
          try {
            const logData = JSON.parse(log.data);
            await this.processCompletionMessage(logData);

            // Mark as processed
            await pushLogs({
              owner_address: log.owner_address,
              project_id: log.project_id,
              agent_name: this.agentName,
              text: `Processed completion for task ${logData.payload?.taskId}`,
              data: JSON.stringify({
                ...logData,
                processed: true,
                processedAt: new Date().toISOString(),
              }),
            });
          } catch (error) {
            console.error("❌ Error processing completion log:", error);
          }
        }
      } catch (error) {
        console.error("❌ Error polling completions:", error);
      }
    }, 5000); // Poll every 5 seconds
  }

  public stop(): void {
    console.log("🛑 Stopping orchestrator...");
    this.isListening = false;
  }
}
