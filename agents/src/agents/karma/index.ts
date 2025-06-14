// src/agents/karma-integration.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";
import {
  KarmaSDKService,
  KarmaProjectData as SDKKarmaProjectData,
  KarmaGrantData,
  KarmaMilestoneData,
} from "./services/karma";
import { Hex } from "viem";
import { ProjectService } from "../../services/project";

interface KarmaProjectData {
  karmaUID: string;
  title?: string;
  description?: string;
  status?: "draft" | "active" | "completed";
  members?: string[];
  grants?: Array<{
    uid: string;
    title: string;
    status: string;
    milestones: Array<{
      uid: string;
      title: string;
      status: string;
      dueDate: string;
    }>;
  }>;
}

interface Grant {
  uid: string;
  title: string;
  status: string;
  milestones: Array<{
    uid: string;
    title: string;
    status: string;
    dueDate: string;
  }>;
}

export class KarmaAgent {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private sqs: SQSClient;
  private karmaSDK: KarmaSDKService;
  private projectService: ProjectService;
  private orchestratorQueue: string;
  private emailQueue: string;
  private socialQueue: string;

  constructor() {
    console.log("🚀 Initializing KarmaAgent");
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.karmaSDK = new KarmaSDKService();
    this.projectService = new ProjectService(this.dynamodb);

    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
    this.emailQueue = process.env.EMAIL_QUEUE_URL!;
    this.socialQueue = process.env.SOCIAL_QUEUE_URL!;

    console.log("📡 Starting opportunity polling");
    // Start the opportunity polling
    this.startOpportunityPolling();
  }

  async processTask(task: any): Promise<any> {
    console.log(`🎯 Processing Karma task: ${task.type}`);
    console.log("📦 Task payload:", JSON.stringify(task.payload, null, 2));

    const characterInfo = task.characterInfo;
    let characterResponse = "";

    try {
      let result;

      switch (task.type) {
        case "CREATE_KARMA_PROJECT":
          console.log("🏗️ Creating new Karma project");
          result = await this.createKarmaProject(task.payload);
          break;

        case "APPLY_FOR_GRANT":
          console.log("📝 Processing grant application");
          result = await this.applyForGrant(task.payload);
          break;

        case "CREATE_MILESTONE":
          console.log("🎯 Creating new milestone");
          result = await this.createMilestone(task.payload);
          break;

        case "UPDATE_MILESTONE":
          console.log("📊 Updating milestone status");
          result = await this.updateMilestone(task.payload);
          break;

        case "SYNC_KARMA_DATA":
          console.log("🔄 Syncing Karma data");
          result = await this.syncKarmaData(task.payload);
          break;

        case "GET_KARMA_PROJECT":
          console.log("🔍 Fetching Karma project");
          result = await this.getKarmaProject(task.payload.karmaProjectId);
          break;

        case "GET_GRANT_OPPORTUNITIES":
          console.log("💰 Fetching grant opportunities");
          result = await this.getGrantOpportunities(task.payload);
          break;

        case "GET_COMMUNITIES":
          console.log("🌐 Fetching communities");
          result = await this.getCommunities(task.payload);
          break;

        case "GET_PROJECTS":
          console.log("📋 Fetching Karma projects");
          result = await this.getProjects(task.payload);
          break;

        default:
          console.error(`❌ Unknown task type: ${task.type}`);
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Generate character response
      if (characterInfo?.agentCharacter) {
        characterResponse =
          characterInfo.side === "light"
            ? "Strong with the Force, your grant opportunities are. Patience you must have, young Padawan."
            : "Your funding will serve the Empire well. The dark side of grants, powerful it is.";
      }

      console.log("✅ Task processing completed");
      console.log("📤 Task result:", JSON.stringify(result, null, 2));

      // Report completion to orchestrator
      await this.reportTaskCompletion(task.taskId, task.workflowId, {
        ...result,
        characterResponse,
      });

      return { ...result, characterResponse };
    } catch (error: any) {
      console.error(`❌ Karma task failed:`, error);

      if (characterInfo?.agentCharacter) {
        characterResponse =
          characterInfo.side === "light"
            ? "Failed, this task has. But learn from failure, we must. Strong you will become."
            : "This failure disturbs me. The Empire does not tolerate incompetence. Try again, you will.";
      }

      // Report failure to orchestrator
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

  // NEW METHODS
  async getGrantOpportunities(payload: any): Promise<any> {
    console.log(`🔍 Fetching grant opportunities`);
    console.log("📦 Payload:", JSON.stringify(payload, null, 2));
    const opportunities = await this.karmaSDK.fetchGrantOpportunities();
    console.log(`✅ Found ${opportunities.length} opportunities`);
    return opportunities;
  }

  async getCommunities(payload: any): Promise<any> {
    console.log(`🌐 Fetching communities`);
    console.log("📦 Payload:", JSON.stringify(payload, null, 2));
    const communities = await this.karmaSDK.fetchGrantOpportunities();
    // Extract unique communities
    const uniqueCommunities = communities.reduce((acc, opportunity) => {
      if (!acc.find((c: any) => c.uid === opportunity.communityUID)) {
        acc.push({
          uid: opportunity.communityUID,
          name: opportunity.communityName,
        });
      }
      return acc;
    }, []);
    console.log(`✅ Found ${uniqueCommunities.length} unique communities`);
    return uniqueCommunities;
  }

  async getProjects(payload: any): Promise<any> {
    console.log(`📋 Fetching Karma projects`);
    console.log("📦 Payload:", JSON.stringify(payload, null, 2));
    const projects = await this.karmaSDK.fetchProjects();
    console.log(`✅ Found ${projects.length} projects`);
    return projects;
  }

  // EXISTING METHODS (unchanged)
  async createKarmaProject(payload: {
    projectId: string;
    title: string;
    description: string;
    imageURL?: string;
    links?: Array<{ type: string; url: string }>;
    tags?: Array<{ name: string }>;
    ownerAddress: Hex;
    members?: Hex[];
    userEmail?: string;
    userName?: string;
  }): Promise<any> {
    console.log(`🚀 Creating Karma project: ${payload.title}`);
    console.log("📦 Project details:", JSON.stringify(payload, null, 2));

    const karmaProjectData: SDKKarmaProjectData = {
      title: payload.title,
      description: payload.description,
      imageURL: payload.imageURL,
      links: payload.links,
      tags: payload.tags,
      ownerAddress: payload.ownerAddress,
      members: payload.members,
    };

    console.log("📤 Creating project in Karma SDK");
    const { uid, project } = await this.karmaSDK.createProject(
      karmaProjectData
    );
    console.log(`✅ Project created with UID: ${uid}`);

    // Update existing project with Karma data
    console.log("📝 Updating local project data");
    const updatedProject = await this.projectService.updateProjectWithKarmaData(
      payload.projectId,
      {
        karmaUID: uid,
        title: payload.title,
        description: payload.description,
        status: "active",
        members: payload.members?.map((addr) => addr.toString()) || [],
        grants: [],
      }
    );
    console.log("✅ Local project updated");

    return {
      success: true,
      karmaUID: uid,
      projectId: payload.projectId,
      title: payload.title,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedProject,
    };
  }

  async applyForGrant(payload: {
    karmaProjectId: Hex;
    grantTitle: string;
    grantDescription: string;
    proposalURL?: string;
    communityUID: string;
    cycle?: string;
    season?: string;
    userEmail?: string;
    userName?: string;
  }): Promise<any> {
    console.log(`📝 Applying for grant: ${payload.grantTitle}`);

    const karmaProject = await this.getKarmaProject(payload.karmaProjectId);
    if (!karmaProject) {
      throw new Error("Karma project not found");
    }

    const grantData: KarmaGrantData = {
      title: payload.grantTitle,
      description: payload.grantDescription,
      proposalURL: payload.proposalURL,
      communityUID: payload.communityUID,
      cycle: payload.cycle,
      season: payload.season,
    };

    const { uids, grant, tx } = await this.karmaSDK.applyForGrant(
      grantData,
      karmaProject.karmaUID as `0x${string}`
    );

    // Update local project
    const updatedProject = await this.projectService.updateProjectWithKarmaData(
      karmaProject.projectId,
      {
        karmaUID: karmaProject.karmaUID,
        grants: [
          ...karmaProject.grants,
          {
            uid: uids[0],
            title: payload.grantTitle,
            status: "pending",
            milestones: [],
          },
        ],
      }
    );

    // Trigger social media post
    await this.sendTaskToAgent(this.socialQueue, {
      taskId: randomUUID(),
      workflowId: randomUUID(),
      type: "POST_GRANT_APPLICATION",
      payload: {
        projectTitle: karmaProject.title,
        grantTitle: payload.grantTitle,
        communityUID: payload.communityUID,
        karmaUID: uids[0],
      },
    });

    // Send confirmation email
    if (payload.userEmail && payload.userName) {
      await this.sendTaskToAgent(this.emailQueue, {
        taskId: randomUUID(),
        workflowId: randomUUID(),
        type: "SEND_EMAIL",
        payload: {
          to: [payload.userEmail],
          subject: `🎯 Grant Application Submitted: ${payload.grantTitle}`,
          body: `Hi ${payload.userName},\n\nYour grant application for "${payload.grantTitle}" has been successfully submitted!\n\nProject: ${karmaProject.title}\nGrant UID: ${uids[0]}\n\nYou'll be notified of any updates.\n\nBest regards,\nKarma Integration Team`,
        },
      });
    }

    return {
      grantUID: uids[0],
      projectUID: karmaProject.karmaUID,
      status: "submitted",
      submittedAt: new Date().toISOString(),
    };
  }

  async createMilestone(payload: {
    karmaProjectId: Hex;
    grantUID: Hex;
    title: string;
    description: string;
    endsAt: number;
    userEmail?: string;
    userName?: string;
  }): Promise<any> {
    console.log(`📋 Creating milestone: ${payload.title}`);

    const karmaProject = await this.getKarmaProject(payload.karmaProjectId);
    if (!karmaProject) {
      throw new Error("Karma project not found");
    }

    const milestoneData: KarmaMilestoneData = {
      title: payload.title,
      description: payload.description,
      endsAt: payload.endsAt,
      grantUID: payload.grantUID,
      projectUID: payload.karmaProjectId,
    };

    const { uids, milestone, tx } = await this.karmaSDK.createMilestone(
      milestoneData
    );

    // Update local project
    const grant = karmaProject.grants.find(
      (g: Grant) => g.uid === payload.grantUID
    );
    if (grant) {
      const updatedGrants = karmaProject.grants.map((g: Grant) => {
        if (g.uid === payload.grantUID) {
          return {
            ...g,
            milestones: [
              ...g.milestones,
              {
                uid: uids[0],
                title: payload.title,
                status: "active",
                dueDate: new Date(payload.endsAt).toISOString(),
              },
            ],
          };
        }
        return g;
      });

      await this.projectService.updateProjectWithKarmaData(
        karmaProject.projectId,
        {
          karmaUID: karmaProject.karmaUID,
          grants: updatedGrants,
        }
      );
    }

    // Trigger social media post
    await this.sendTaskToAgent(this.socialQueue, {
      taskId: randomUUID(),
      workflowId: randomUUID(),
      type: "POST_MILESTONE_CREATED",
      payload: {
        projectTitle: karmaProject.title,
        milestoneTitle: payload.title,
        dueDate: new Date(payload.endsAt).toLocaleDateString(),
        karmaUID: uids[0],
      },
    });

    // Send confirmation email
    if (payload.userEmail && payload.userName) {
      await this.sendTaskToAgent(this.emailQueue, {
        taskId: randomUUID(),
        workflowId: randomUUID(),
        type: "SEND_EMAIL",
        payload: {
          to: [payload.userEmail],
          subject: `🎯 Milestone Created: ${payload.title}`,
          body: `Hi ${payload.userName},\n\nYour milestone "${
            payload.title
          }" has been created!\n\nProject: ${
            karmaProject.title
          }\nDue Date: ${new Date(
            payload.endsAt
          ).toLocaleDateString()}\nMilestone UID: ${
            uids[0]
          }\n\nGood luck achieving this milestone!\n\nBest regards,\nKarma Integration Team`,
        },
      });
    }

    return {
      milestoneUID: uids[0],
      grantUID: payload.grantUID,
      projectUID: karmaProject.karmaUID,
      status: "created",
      createdAt: new Date().toISOString(),
    };
  }

  async updateMilestone(payload: {
    karmaProjectId: Hex;
    grantUID: Hex;
    milestoneUID: Hex;
    title: string;
    description: string;
    endsAt: number;
    userEmail?: string;
    userName?: string;
  }): Promise<any> {
    console.log(`✅ Completing milestone: ${payload.milestoneUID}`);

    const karmaProject = await this.getKarmaProject(payload.karmaProjectId);
    if (!karmaProject) {
      throw new Error("Karma project not found");
    }

    const { uids, update } = await this.karmaSDK.updateMilestone(
      karmaProject.karmaUID as `0x${string}`,
      payload.grantUID as `0x${string}`,
      payload.milestoneUID as `0x${string}`,
      {
        title: payload.title,
        description: payload.description,
        endsAt: payload.endsAt,
      }
    );

    // Update local project
    const updatedGrants = karmaProject.grants.map((grant: Grant) => {
      const updatedMilestones = grant.milestones.map(
        (milestone: { uid: string; status: string }) => {
          if (milestone.uid === payload.milestoneUID) {
            return { ...milestone, status: "completed" };
          }
          return milestone;
        }
      );
      return { ...grant, milestones: updatedMilestones };
    });

    await this.projectService.updateProjectWithKarmaData(
      karmaProject.projectId,
      {
        karmaUID: karmaProject.karmaUID,
        grants: updatedGrants,
      }
    );

    // Trigger social media post
    await this.sendTaskToAgent(this.socialQueue, {
      taskId: randomUUID(),
      workflowId: randomUUID(),
      type: "POST_MILESTONE_COMPLETED",
      payload: {
        projectTitle: karmaProject.title,
        milestoneTitle: payload.title,
        karmaUID: uids[0],
        grantUID: payload.grantUID,
        milestoneUID: payload.milestoneUID,
      },
    });

    // Send confirmation email
    if (payload.userEmail && payload.userName) {
      await this.sendTaskToAgent(this.emailQueue, {
        taskId: randomUUID(),
        workflowId: randomUUID(),
        type: "SEND_EMAIL",
        payload: {
          to: [payload.userEmail],
          subject: `🎉 Milestone Completed: ${payload.title}`,
          body: `Hi ${payload.userName},\n\nCongratulations! Your milestone "${payload.title}" has been marked as completed!\n\nProject: ${karmaProject.title}\nUpdate UID: ${uids[0]}\n\nKeep up the great work!\n\nBest regards,\nKarma Integration Team`,
        },
      });
    }

    return {
      updateUID: uids[0],
      milestoneUID: payload.milestoneUID,
      status: "completed",
      completedAt: new Date().toISOString(),
    };
  }

  async syncKarmaData(payload: { projectId?: string }): Promise<any> {
    console.log(`🔄 Syncing Karma data`);

    let karmaProjects: any[];

    if (payload.projectId) {
      const project = await this.getKarmaProject(payload.projectId);
      karmaProjects = project ? [project] : [];
    } else {
      karmaProjects = await this.getAllKarmaProjects();
    }

    const syncResults = [];

    for (const karmaProject of karmaProjects) {
      try {
        const project = await this.karmaSDK.fetchProjectBySlug(
          karmaProject.karmaUID
        );

        // Update local data with Karma data
        if (project) {
          // Sync grants and milestones
          const updatedGrants = project.grants.map((grant) => ({
            uid: grant.uid,
            title: grant.details?.title || "Untitled Grant",
            status: this.mapGrantStatus(grant),
            milestones: grant.milestones.map((milestone) => ({
              uid: milestone.uid,
              title: milestone.data.title,
              status: this.mapMilestoneStatus(milestone),
              dueDate: new Date(milestone.data.endsAt).toISOString(),
            })),
          }));

          await this.projectService.updateProjectWithKarmaData(
            karmaProject.projectId,
            {
              karmaUID: karmaProject.karmaUID,
              grants: updatedGrants,
            }
          );
        }

        syncResults.push({
          karmaProjectId: karmaProject.projectId,
          status: "synced",
          syncedAt: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error(
          `Failed to sync project ${karmaProject.projectId}:`,
          error
        );
        syncResults.push({
          karmaProjectId: karmaProject.projectId,
          status: "failed",
          error: error.message,
        });
      }
    }

    return {
      projectsSynced: syncResults.length,
      results: syncResults,
    };
  }

  private async startOpportunityPolling(): Promise<void> {
    // Poll for new grant opportunities every 24 hours
    setInterval(async () => {
      try {
        await this.checkForNewOpportunities();
      } catch (error) {
        console.error("Error checking for new opportunities:", error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Initial check
    setTimeout(() => this.checkForNewOpportunities(), 5000);
  }

  private async checkForNewOpportunities(): Promise<void> {
    console.log("🔍 Checking for new grant opportunities...");

    try {
      const opportunities = await this.karmaSDK.fetchGrantOpportunities();
      const allProjects = await this.getAllKarmaProjects();

      for (const opportunity of opportunities) {
        // For each active project, check if this is a relevant opportunity
        for (const project of allProjects.filter(
          (p) => p.status === "active"
        )) {
          const isRelevant = await this.isOpportunityRelevant(
            project,
            opportunity
          );

          if (isRelevant) {
            // For now, use a placeholder email - you'll need to implement proper user email mapping
            const userEmail = "user@example.com"; // TODO: Map ownerAddress to actual email
            const userName = "Project Owner"; // TODO: Map to actual user name

            // Send grant opportunity email
            await this.sendTaskToAgent(this.emailQueue, {
              taskId: randomUUID(),
              workflowId: randomUUID(),
              type: "GRANT_OPPORTUNITY",
              payload: {
                userEmail,
                userName,
                projectName: project.title,
                grant: {
                  title: opportunity.grantTitle,
                  organization: opportunity.communityName,
                  amount: opportunity.amount || "Amount not specified",
                  deadline: opportunity.deadline || "No deadline specified",
                  description: opportunity.grantDescription,
                  eligibility: opportunity.requirements || [],
                  applicationUrl: `https://gap.karma.global/grants/${opportunity.grantUID}`,
                  matchScore: Math.floor(Math.random() * 20) + 80,
                },
              },
            });
          }
        }
      }
    } catch (error) {
      console.error("Error in opportunity checking:", error);
    }
  }

  private async isOpportunityRelevant(
    project: any,
    opportunity: any
  ): Promise<boolean> {
    // Simple relevance check - in production, use AI/ML for better matching
    const projectTags = project.description.toLowerCase();
    const opportunityText = (
      opportunity.grantTitle +
      " " +
      opportunity.grantDescription
    ).toLowerCase();

    // Check for common keywords
    const keywords = [
      "dao",
      "defi",
      "nft",
      "web3",
      "blockchain",
      "smart contract",
      "dapp",
    ];

    for (const keyword of keywords) {
      if (projectTags.includes(keyword) && opportunityText.includes(keyword)) {
        return true;
      }
    }

    return false;
  }

  private mapGrantStatus(grant: any): string {
    // Map Karma grant status to local status
    return grant.status || "active";
  }

  private mapMilestoneStatus(milestone: any): string {
    // Map Karma milestone status to local status
    return milestone.completed ? "completed" : "active";
  }

  private async sendTaskToAgent(queueUrl: string, task: any): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(task),
      })
    );
  }

  private async getKarmaProject(projectId: string): Promise<any | null> {
    return await this.projectService.getProject(projectId);
  }

  private async getAllKarmaProjects(): Promise<any[]> {
    return await this.projectService.getProjectsByInitState("KARMA");
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string,
    characterResponse?: string
  ) {
    try {
      console.log(`📤 Reporting task completion to orchestrator:`, {
        taskId,
        workflowId,
        status: error ? "FAILED" : "COMPLETED",
        hasResult: !!result,
        hasError: !!error,
        hasCharacterResponse: !!characterResponse,
      });

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
              agent: "karma-integration",
            },
          }),
        })
      );

      console.log("✅ Task completion reported successfully");
    } catch (err) {
      console.error("❌ Failed to report task completion:", err);
    }
  }
}
