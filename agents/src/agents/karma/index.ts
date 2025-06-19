// src/agents/karma-integration.ts
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";
import {
  KarmaSDKService,
  KarmaProjectData,
  KarmaGrantData,
  KarmaMilestoneData,
  KarmaData,
} from "./service";
import { Hex } from "viem";

export class KarmaAgent {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private sqs: SQSClient;
  private karmaSDK: KarmaSDKService;
  private projectsTableName: string;
  private projectPollers: Map<string, NodeJS.Timeout> = new Map();
  private orchestratorQueue: string;
  private emailQueue: string;
  private socialQueue: string;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.karmaSDK = new KarmaSDKService();

    this.projectsTableName = process.env.PROJECTS_TABLE_NAME!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
    this.emailQueue = process.env.EMAIL_QUEUE_URL!;
    this.socialQueue = process.env.SOCIALS_QUEUE_URL!;

    this.restoreProjectPollers();
  }

  async processTask(task: any): Promise<void> {
    console.log(`🎯 Processing Karma task: ${task.type}`);

    const characterInfo = task.characterInfo;
    let characterResponse = "";

    try {
      let payload;

      switch (task.type) {
        case "CREATE_KARMA_PROJECT":
          const karmaProject = await this.createKarmaProject(task.payload);
          payload = { karmaProject };
          break;

        case "APPLY_FOR_GRANT":
          const grantApplication = await this.applyForGrant(task.payload);
          payload = { grantApplication };
          break;

        case "CREATE_MILESTONE":
          const milestone = await this.createMilestone(task.payload);
          payload = { milestone };
          break;

        case "UPDATE_MILESTONE":
          const milestoneUpdate = await this.updateMilestone(task.payload);
          payload = { milestoneUpdate };
          break;

        case "SYNC_KARMA_DATA":
          const syncResult = await this.syncKarmaData(task.payload);
          payload = { syncResult };
          break;

        case "GET_KARMA_PROJECT":
          const project = await this.getKarmaProject(
            task.payload.karmaProjectId
          );
          payload = { project };
          break;

        // NEW TASK TYPES
        case "GET_GRANT_OPPORTUNITIES":
          const opportunities = await this.getGrantOpportunities(task.payload);
          payload = { opportunities };
          break;

        case "GET_COMMUNITIES":
          const communities = await this.getCommunities(task.payload);
          payload = { communities };
          break;

        case "GET_PROJECTS":
          const projects = await this.getProjects(task.payload);
          payload = { projects };
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Generate character response
      if (characterInfo?.agentCharacter) {
        if (characterInfo.side === "light") {
          characterResponse =
            "Strong with the Force, your grant opportunities are. Patience you must have, young Padawan. Believe in your project's potential, I do.";
        } else {
          characterResponse =
            "Your funding will serve the Empire well. The dark side of grants, powerful it is. Impressive... most impressive.";
        }
      }

      await this.reportTaskCompletion(task.taskId, task.workflowId, {
        ...payload,
        characterResponse,
      });
    } catch (error: any) {
      if (characterInfo?.agentCharacter) {
        characterResponse =
          characterInfo.side === "light"
            ? "Failed, this task has. But learn from failure, we must. Strong you will become."
            : "This failure disturbs me. The Empire does not tolerate incompetence. Try again, you will.";
      }

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
    return await this.karmaSDK.fetchGrantOpportunities();
  }

  async getCommunities(payload: any): Promise<any> {
    console.log(`🌐 Fetching communities`);
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
    return uniqueCommunities;
  }

  async getProjects(payload: any): Promise<any> {
    console.log(`📋 Fetching Karma projects`);
    return await this.karmaSDK.fetchProjects();
  }

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

    const karmaProjectData: KarmaProjectData = {
      title: payload.title,
      description: payload.description,
      imageURL: payload.imageURL,
      links: payload.links,
      tags: payload.tags,
      ownerAddress: payload.ownerAddress,
      members: payload.members,
    };

    const { uid, project } = await this.karmaSDK.createProject(
      karmaProjectData
    );

    // Store karma data in main projects table
    const karmaData: KarmaData = {
      karmaUID: uid,
      status: "active",
      grants: [],
      createdAt: new Date().toISOString(),
      syncedAt: new Date().toISOString(),
      opportunityNotifications: [], // Track notified opportunities
    };

    await this.updateProjectKarmaData(payload.projectId, karmaData);

    // START PROJECT-SPECIFIC POLLING
    this.startProjectOpportunityPolling(payload.projectId);

    // Send confirmation email
    if (payload.userEmail && payload.userName) {
      await this.sendTaskToAgent(this.emailQueue, {
        taskId: randomUUID(),
        workflowId: randomUUID(),
        type: "SEND_EMAIL",
        payload: {
          to: [payload.userEmail],
          subject: `✅ Karma Project Created: ${payload.title}`,
          body: `Hi ${payload.userName},\n\nYour project "${payload.title}" has been successfully created on Karma GAP!\n\nKarma UID: ${uid}\n\nYou can now apply for grants and create milestones.\n\nWe'll notify you of relevant grant opportunities every 24 hours.\n\nBest regards,\nKarma Integration Team`,
        },
      });
    }

    return { karmaUID: uid, status: "created" };
  }

  // Add method to deactivate project
  async deactivateKarmaProject(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (project?.karma) {
      // Update status
      await this.updateProjectKarmaData(projectId, {
        ...project.karma,
        status: "completed",
        syncedAt: new Date().toISOString(),
      });

      // Stop polling
      this.stopProjectOpportunityPolling(projectId);
    }
  }

  // Add method to reactivate project
  async reactivateKarmaProject(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (project?.karma) {
      // Update status
      await this.updateProjectKarmaData(projectId, {
        ...project.karma,
        status: "active",
        syncedAt: new Date().toISOString(),
      });

      // Start polling
      this.startProjectOpportunityPolling(projectId);
    }
  }

  // Restore project pollers when server starts
  private async restoreProjectPollers(): Promise<void> {
    console.log("🔄 Restoring project opportunity pollers...");

    try {
      const activeProjects = await this.getAllKarmaProjects();

      for (const project of activeProjects) {
        if (project.karma?.status === "active") {
          this.startProjectOpportunityPolling(project.projectId);
        }
      }

      console.log(
        `✅ Restored polling for ${this.projectPollers.size} active projects`
      );
    } catch (error) {
      console.error("Error restoring project pollers:", error);
    }
  }

  // Prevent duplicate notifications
  private async hasNotifiedAboutOpportunity(
    projectId: string,
    grantUID: string
  ): Promise<boolean> {
    const project = await this.getProject(projectId);
    return (
      project?.karma?.opportunityNotifications?.includes(grantUID) || false
    );
  }

  private async markOpportunityAsNotified(
    projectId: string,
    grantUID: string
  ): Promise<void> {
    const project = await this.getProject(projectId);
    if (project?.karma) {
      const notifications = project.karma.opportunityNotifications || [];

      await this.updateProjectKarmaData(projectId, {
        ...project.karma,
        opportunityNotifications: [...notifications, grantUID],
        syncedAt: new Date().toISOString(),
      });
    }
  }

  private async sendOpportunityNotification(
    project: any,
    opportunity: any
  ): Promise<void> {
    // TODO: Get real user email from project owner
    const userEmail = "user@example.com";
    const userName = "Project Owner";

    await this.sendTaskToAgent(this.emailQueue, {
      taskId: randomUUID(),
      workflowId: randomUUID(),
      type: "GRANT_OPPORTUNITY",
      payload: {
        userEmail,
        userName,
        projectName: project.name,
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

  async applyForGrant(payload: {
    projectId: string;
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

    const project = await this.getProject(payload.projectId);
    if (!project?.karma?.karmaUID) {
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
      project.karma.karmaUID as `0x${string}`
    );

    // Update local project karma data
    const updatedGrants = [
      ...(project.karma.grants || []),
      {
        uid: uids[0],
        title: payload.grantTitle,
        status: "pending",
        milestones: [],
      },
    ];

    await this.updateProjectKarmaData(payload.projectId, {
      ...project.karma,
      grants: updatedGrants,
      syncedAt: new Date().toISOString(),
    });

    // Trigger social media post
    await this.sendTaskToAgent(this.socialQueue, {
      taskId: randomUUID(),
      workflowId: randomUUID(),
      type: "POST_GRANT_APPLICATION",
      payload: {
        projectTitle: project.name,
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
          body: `Hi ${payload.userName},\n\nYour grant application for "${payload.grantTitle}" has been successfully submitted!\n\nProject: ${project.name}\nGrant UID: ${uids[0]}\n\nYou'll be notified of any updates.\n\nBest regards,\nKarma Integration Team`,
        },
      });
    }

    return {
      grantUID: uids[0],
      projectUID: project.karma.karmaUID,
      status: "submitted",
      submittedAt: new Date().toISOString(),
    };
  }

  async createMilestone(payload: {
    projectId: string;
    grantUID: Hex;
    title: string;
    description: string;
    endsAt: number;
    userEmail?: string;
    userName?: string;
  }): Promise<any> {
    console.log(`📋 Creating milestone: ${payload.title}`);

    const project = await this.getProject(payload.projectId);
    if (!project?.karma?.karmaUID) {
      throw new Error("Karma project not found");
    }

    const milestoneData: KarmaMilestoneData = {
      title: payload.title,
      description: payload.description,
      endsAt: payload.endsAt,
      grantUID: payload.grantUID,
      projectUID: project.karma.karmaUID as `0x${string}`,
    };

    const { uids, milestone, tx } = await this.karmaSDK.createMilestone(
      milestoneData
    );

    // Update local project karma data
    const updatedGrants = project.karma.grants.map((grant: any) => {
      if (grant.uid === payload.grantUID) {
        return {
          ...grant,
          milestones: [
            ...grant.milestones,
            {
              uid: uids[0],
              title: payload.title,
              status: "active",
              dueDate: new Date(payload.endsAt).toISOString(),
            },
          ],
        };
      }
      return grant;
    });

    await this.updateProjectKarmaData(payload.projectId, {
      ...project.karma,
      grants: updatedGrants,
      syncedAt: new Date().toISOString(),
    });

    // Trigger social media post
    await this.sendTaskToAgent(this.socialQueue, {
      taskId: randomUUID(),
      workflowId: randomUUID(),
      type: "POST_MILESTONE_CREATED",
      payload: {
        projectTitle: project.name,
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
            project.name
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
      projectUID: project.karma.karmaUID,
      status: "created",
      createdAt: new Date().toISOString(),
    };
  }

  async updateMilestone(payload: {
    projectId: string;
    grantUID: Hex;
    milestoneUID: Hex;
    title: string;
    description: string;
    endsAt: number;
    userEmail?: string;
    userName?: string;
  }): Promise<any> {
    console.log(`✅ Completing milestone: ${payload.milestoneUID}`);

    const project = await this.getProject(payload.projectId);
    if (!project?.karma?.karmaUID) {
      throw new Error("Karma project not found");
    }

    const { uids, update } = await this.karmaSDK.updateMilestone(
      project.karma.karmaUID as `0x${string}`,
      payload.grantUID as `0x${string}`,
      payload.milestoneUID as `0x${string}`,
      {
        title: payload.title,
        description: payload.description,
        endsAt: payload.endsAt,
      }
    );

    // Update local project karma data
    const updatedGrants = project.karma.grants.map((grant: any) => {
      if (grant.uid === payload.grantUID) {
        return {
          ...grant,
          milestones: grant.milestones.map((milestone: any) => {
            if (milestone.uid === payload.milestoneUID) {
              return {
                ...milestone,
                status: "completed",
              };
            }
            return milestone;
          }),
        };
      }
      return grant;
    });

    await this.updateProjectKarmaData(payload.projectId, {
      ...project.karma,
      grants: updatedGrants,
      syncedAt: new Date().toISOString(),
    });

    // Trigger social media post
    await this.sendTaskToAgent(this.socialQueue, {
      taskId: randomUUID(),
      workflowId: randomUUID(),
      type: "POST_MILESTONE_COMPLETED",
      payload: {
        projectTitle: project.name,
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
          body: `Hi ${payload.userName},\n\nCongratulations! Your milestone "${payload.title}" has been marked as completed!\n\nProject: ${project.name}\nUpdate UID: ${uids[0]}\n\nKeep up the great work!\n\nBest regards,\nKarma Integration Team`,
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

    let projects: any[];

    if (payload.projectId) {
      const project = await this.getProject(payload.projectId);
      projects = project?.karma ? [project] : [];
    } else {
      projects = await this.getAllKarmaProjects();
    }

    const syncResults = [];

    for (const project of projects) {
      try {
        const karmaProject = await this.karmaSDK.fetchProjectBySlug(
          project.karma.karmaUID
        );

        // Update local data with Karma data
        if (karmaProject) {
          const updatedGrants = karmaProject.grants.map((grant) => ({
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

          await this.updateProjectKarmaData(project.projectId, {
            ...project.karma,
            grants: updatedGrants,
            syncedAt: new Date().toISOString(),
          });
        }

        syncResults.push({
          projectId: project.projectId,
          status: "synced",
          syncedAt: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error(`Failed to sync project ${project.projectId}:`, error);
        syncResults.push({
          projectId: project.projectId,
          status: "failed",
          error: error.message,
        });
      }
    }

    return {
      projectsSynced: syncResults.length,
      payloads: syncResults,
    };
  }

  async getKarmaProject(projectId: string): Promise<any> {
    return await this.getProject(projectId);
  }

  private mapGrantStatus(grant: any): string {
    // Map Karma grant status to local status
    return grant.status || "active";
  }

  // Start polling for a specific project
  private startProjectOpportunityPolling(projectId: string): void {
    console.log(`🔍 Starting opportunity polling for project: ${projectId}`);

    // Clear any existing poller for this project
    this.stopProjectOpportunityPolling(projectId);

    // Create new poller
    const poller = setInterval(async () => {
      try {
        await this.checkOpportunitiesForProject(projectId);
      } catch (error) {
        console.error(
          `Error checking opportunities for project ${projectId}:`,
          error
        );
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    this.projectPollers.set(projectId, poller);

    // Do initial check after 5 seconds
    setTimeout(() => this.checkOpportunitiesForProject(projectId), 5000);
  }

  // Stop polling for a specific project
  private stopProjectOpportunityPolling(projectId: string): void {
    const poller = this.projectPollers.get(projectId);
    if (poller) {
      clearInterval(poller);
      this.projectPollers.delete(projectId);
      console.log(`⏹️ Stopped opportunity polling for project: ${projectId}`);
    }
  }

  // Check opportunities for a single project
  private async checkOpportunitiesForProject(projectId: string): Promise<void> {
    console.log(`🔍 Checking opportunities for project: ${projectId}`);

    try {
      const project = await this.getProject(projectId);
      if (!project?.karma || project.karma.status !== "active") {
        console.log(`Project ${projectId} is not active, stopping polling`);
        this.stopProjectOpportunityPolling(projectId);
        return;
      }

      const opportunities = await this.karmaSDK.fetchGrantOpportunities();

      for (const opportunity of opportunities) {
        const isRelevant = await this.isOpportunityRelevant(
          project,
          opportunity
        );

        if (isRelevant) {
          // Check if we've already notified about this opportunity
          const hasNotified = await this.hasNotifiedAboutOpportunity(
            projectId,
            opportunity.grantUID
          );
          if (hasNotified) continue;

          // Mark as notified
          await this.markOpportunityAsNotified(projectId, opportunity.grantUID);

          // Send notification
          await this.sendOpportunityNotification(project, opportunity);
        }
      }
    } catch (error) {
      console.error(
        `Error checking opportunities for project ${projectId}:`,
        error
      );
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

  // Updated methods to work with main projects table
  private async getProject(projectId: string): Promise<any> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.projectsTableName,
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({
          ":projectId": projectId,
        }),
      })
    );

    return response.Items ? unmarshall(response.Items[0]) : null;
  }

  private async getAllKarmaProjects(): Promise<any[]> {
    // Get all projects that have karma data
    const response = await this.dynamodb.send(
      new ScanCommand({
        TableName: this.projectsTableName,
        FilterExpression: "attribute_exists(karma)",
      })
    );

    return (response.Items || []).map((item) => unmarshall(item));
  }

  private async updateProjectKarmaData(
    projectId: string,
    karmaData: KarmaData
  ): Promise<void> {
    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: this.projectsTableName,
        Key: marshall({ projectId }),
        UpdateExpression: "SET karma = :karma",
        ExpressionAttributeValues: marshall({
          ":karma": karmaData,
        }),
      })
    );
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    payload: any,
    error?: string,
    characterResponse?: string
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
              payload: payload ? { ...payload, characterResponse } : null,
              error,
              timestamp: new Date().toISOString(),
              agent: "karma-integration",
            },
          }),
        })
      );
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }

  public async shutdown(): Promise<void> {
    console.log("🛑 Shutting down Karma agent...");

    // Stop all project pollers
    for (const [projectId, poller] of this.projectPollers) {
      clearInterval(poller);
      console.log(`⏹️ Stopped polling for project: ${projectId}`);
    }

    this.projectPollers.clear();
    console.log("✅ Karma agent shutdown complete");
  }
}
