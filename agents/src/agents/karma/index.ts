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
} from "./service";
import { Hex } from "viem";

interface KarmaProject {
  karmaProjectId: string;
  projectId: string;
  karmaUID: string;
  title: string;
  description: string;
  status: "draft" | "active" | "completed";
  ownerAddress: string;
  members: string[];
  grants: Array<{
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
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

export class KarmaAgent {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private sqs: SQSClient;
  private karmaSDK: KarmaSDKService;
  private karmaProjectsTableName: string;
  private orchestratorQueue: string;
  private emailQueue: string;
  private socialQueue: string;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.karmaSDK = new KarmaSDKService();

    this.karmaProjectsTableName = process.env.KARMA_PROJECTS_TABLE!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
    this.emailQueue = process.env.EMAIL_QUEUE_URL!;
    this.socialQueue = process.env.SOCIALS_QUEUE_URL!;

    // Start the opportunity polling
    this.startOpportunityPolling();
  }

  async processTask(task: any): Promise<void> {
    console.log(`🎯 Processing Karma task: ${task.type}`);

    const characterInfo = task.characterInfo;
    let characterResponse = "";

    try {
      let result;

      switch (task.type) {
        case "CREATE_KARMA_PROJECT":
          const karmaProject = await this.createKarmaProject(task.payload);
          result = { karmaProject };
          break;

        case "APPLY_FOR_GRANT":
          const grantApplication = await this.applyForGrant(task.payload);
          result = { grantApplication };
          break;

        case "CREATE_MILESTONE":
          const milestone = await this.createMilestone(task.payload);
          result = { milestone };
          break;

        case "UPDATE_MILESTONE":
          const milestoneUpdate = await this.updateMilestone(task.payload);
          result = { milestoneUpdate };
          break;

        case "SYNC_KARMA_DATA":
          const syncResult = await this.syncKarmaData(task.payload);
          result = { syncResult };
          break;

        case "GET_KARMA_PROJECT":
          const project = await this.getKarmaProject(
            task.payload.karmaProjectId
          );
          result = { project };
          break;

        // NEW TASK TYPES
        case "GET_GRANT_OPPORTUNITIES":
          const opportunities = await this.getGrantOpportunities(task.payload);
          result = { opportunities };
          break;

        case "GET_COMMUNITIES":
          const communities = await this.getCommunities(task.payload);
          result = { communities };
          break;

        case "GET_PROJECTS":
          const projects = await this.getProjects(task.payload);
          result = { projects };
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
        ...result,
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
  }): Promise<KarmaProject> {
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

    const karmaProject: KarmaProject = {
      karmaProjectId: randomUUID(),
      projectId: payload.projectId,
      karmaUID: uid,
      title: payload.title,
      description: payload.description,
      status: "active",
      ownerAddress: payload.ownerAddress,
      members: payload.members || [],
      grants: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    };

    await this.storeKarmaProject(karmaProject);

    // Send confirmation email
    if (payload.userEmail && payload.userName) {
      await this.sendTaskToAgent(this.emailQueue, {
        taskId: randomUUID(),
        workflowId: randomUUID(),
        type: "SEND_EMAIL",
        payload: {
          to: [payload.userEmail],
          subject: `✅ Karma Project Created: ${payload.title}`,
          body: `Hi ${payload.userName},\n\nYour project "${payload.title}" has been successfully created on Karma GAP!\n\nKarma UID: ${uid}\n\nYou can now apply for grants and create milestones.\n\nBest regards,\nKarma Integration Team`,
        },
      });
    }

    return karmaProject;
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
    karmaProject.grants.push({
      uid: uids[0],
      title: payload.grantTitle,
      status: "pending",
      milestones: [],
    });
    karmaProject.updatedAt = new Date().toISOString();
    await this.storeKarmaProject(karmaProject);

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
    const grant = karmaProject.grants.find((g) => g.uid === payload.grantUID);
    if (grant) {
      grant.milestones.push({
        uid: uids[0],
        title: payload.title,
        status: "active",
        dueDate: new Date(payload.endsAt).toISOString(),
      });
    }
    karmaProject.updatedAt = new Date().toISOString();
    await this.storeKarmaProject(karmaProject);

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
    for (const grant of karmaProject.grants) {
      const milestone = grant.milestones.find(
        (m) => m.uid === payload.milestoneUID
      );
      if (milestone) {
        milestone.status = "completed";
        break;
      }
    }
    karmaProject.updatedAt = new Date().toISOString();
    await this.storeKarmaProject(karmaProject);

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

    let karmaProjects: KarmaProject[];

    if (payload.projectId) {
      const project = await this.getKarmaProjectByProjectId(payload.projectId);
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
          karmaProject.grants = project.grants.map((grant) => ({
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

          karmaProject.syncedAt = new Date().toISOString();
          await this.storeKarmaProject(karmaProject);
        }

        syncResults.push({
          karmaProjectId: karmaProject.karmaProjectId,
          status: "synced",
          syncedAt: karmaProject.syncedAt,
        });
      } catch (error: any) {
        console.error(
          `Failed to sync project ${karmaProject.karmaProjectId}:`,
          error
        );
        syncResults.push({
          karmaProjectId: karmaProject.karmaProjectId,
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
    project: KarmaProject,
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

  private async getKarmaProject(
    karmaProjectId: Hex
  ): Promise<KarmaProject | null> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.karmaProjectsTableName,
        KeyConditionExpression: "karmaProjectId = :karmaProjectId",
        ExpressionAttributeValues: marshall({
          ":karmaProjectId": karmaProjectId,
        }),
      })
    );

    return response.Items
      ? (unmarshall(response.Items[0]) as KarmaProject)
      : null;
  }

  private async getKarmaProjectByProjectId(
    projectId: string
  ): Promise<KarmaProject | null> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.karmaProjectsTableName,
        IndexName: "projectId-index",
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({ ":projectId": projectId }),
      })
    );

    return response.Items
      ? (unmarshall(response.Items[0]) as KarmaProject)
      : null;
  }

  private async getAllKarmaProjects(): Promise<KarmaProject[]> {
    const response = await this.dynamodb.send(
      new ScanCommand({
        TableName: this.karmaProjectsTableName,
      })
    );

    return (response.Items || []).map(
      (item) => unmarshall(item) as KarmaProject
    );
  }

  private async storeKarmaProject(karmaProject: KarmaProject): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.karmaProjectsTableName,
        Item: marshall(karmaProject),
      })
    );
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
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
              result: result ? { ...result, characterResponse } : null,
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
}
