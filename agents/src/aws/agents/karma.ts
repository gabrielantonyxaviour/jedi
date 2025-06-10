// src/agents/karma-integration.ts
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

interface KarmaProject {
  karmaProjectId: string;
  projectId: string;
  karmaId: string;
  title: string;
  description: string;
  status:
    | "draft"
    | "submitted"
    | "approved"
    | "rejected"
    | "active"
    | "completed";
  grantAmount?: number;
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    status: "pending" | "in_progress" | "completed" | "verified";
    dueDate: string;
    amount?: number;
  }>;
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

export class KarmaAgent {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private sqs: SQSClient;
  private secrets: SecretsManagerClient;
  private bedrock: BedrockRuntimeClient;
  private karmaProjectsTableName: string;
  private projectsTableName: string;
  private bucketName: string;
  private orchestratorQueue: string;
  private karmaCredentials: any;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.secrets = new SecretsManagerClient({ region: process.env.AWS_REGION });
    this.bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

    this.karmaProjectsTableName = process.env.KARMA_PROJECTS_TABLE!;
    this.projectsTableName = process.env.PROJECTS_TABLE_NAME!;
    this.bucketName = process.env.KARMA_BUCKET!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
  }

  async processTask(task: any): Promise<void> {
    console.log(`🎯 Processing Karma integration task: ${task.type}`);

    try {
      switch (task.type) {
        case "CREATE_KARMA_PROJECT":
          const karmaProject = await this.createKarmaProject(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            karmaProject,
          });
          break;

        case "SUBMIT_GRANT_APPLICATION":
          const application = await this.submitGrantApplication(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            application,
          });
          break;

        case "UPDATE_MILESTONE":
          const milestone = await this.updateMilestone(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            milestone,
          });
          break;

        case "SYNC_KARMA_DATA":
          const syncResult = await this.syncKarmaData(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            syncResult,
          });
          break;

        case "GENERATE_PROGRESS_REPORT":
          const report = await this.generateProgressReport(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            report,
          });
          break;
      }
    } catch (error: any) {
      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        null,
        error.message
      );
      throw error;
    }
  }

  async createKarmaProject(payload: {
    projectId: string;
    title: string;
    description: string;
    requestedAmount: number;
    timeline: string;
    milestones: Array<{
      title: string;
      description: string;
      dueDate: string;
      amount?: number;
    }>;
  }): Promise<KarmaProject> {
    const karmaProjectId = randomUUID();

    const karmaProject: KarmaProject = {
      karmaProjectId,
      projectId: payload.projectId,
      karmaId: "", // Will be populated when submitted to Karma
      title: payload.title,
      description: payload.description,
      status: "draft",
      grantAmount: payload.requestedAmount,
      milestones: payload.milestones.map((m) => ({
        id: randomUUID(),
        title: m.title,
        description: m.description,
        status: "pending",
        dueDate: m.dueDate,
        amount: m.amount,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    };

    await this.storeKarmaProject(karmaProject);

    // Generate optimized project description using AI
    const optimizedDescription = await this.optimizeProjectDescription(
      karmaProject
    );
    karmaProject.description = optimizedDescription;

    await this.storeKarmaProject(karmaProject);

    return karmaProject;
  }

  async submitGrantApplication(payload: {
    karmaProjectId: string;
  }): Promise<any> {
    const karmaProject = await this.getKarmaProject(payload.karmaProjectId);

    if (!karmaProject) {
      throw new Error("Karma project not found");
    }

    console.log(
      `📝 Submitting grant application to Karma for: ${karmaProject.title}`
    );

    // TODO: Integrate with actual Karma GAP API
    // For now, simulate the submission
    const submissionResult = await this.submitToKarmaAPI(karmaProject);

    // Update project status
    karmaProject.status = "submitted";
    karmaProject.karmaId = submissionResult.karmaId;
    karmaProject.updatedAt = new Date().toISOString();

    await this.storeKarmaProject(karmaProject);

    return {
      karmaProjectId: karmaProject.karmaProjectId,
      karmaId: submissionResult.karmaId,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      applicationUrl: submissionResult.applicationUrl,
    };
  }

  async updateMilestone(payload: {
    karmaProjectId: string;
    milestoneId: string;
    status: string;
    evidenceFiles?: string[];
    notes?: string;
  }): Promise<any> {
    const karmaProject = await this.getKarmaProject(payload.karmaProjectId);

    if (!karmaProject) {
      throw new Error("Karma project not found");
    }

    const milestone = karmaProject.milestones.find(
      (m) => m.id === payload.milestoneId
    );

    if (!milestone) {
      throw new Error("Milestone not found");
    }

    // Update milestone
    milestone.status = payload.status as any;

    // Store evidence files if provided
    if (payload.evidenceFiles) {
      for (const file of payload.evidenceFiles) {
        await this.storeEvidenceFile(
          payload.karmaProjectId,
          payload.milestoneId,
          file
        );
      }
    }

    karmaProject.updatedAt = new Date().toISOString();
    await this.storeKarmaProject(karmaProject);

    // TODO: Sync with Karma GAP
    await this.syncMilestoneWithKarma(karmaProject, milestone);

    return {
      milestoneId: payload.milestoneId,
      status: payload.status,
      updatedAt: new Date().toISOString(),
    };
  }

  async syncKarmaData(payload: {
    projectId?: string;
    karmaProjectId?: string;
  }): Promise<any> {
    console.log(`🔄 Syncing Karma data`);

    let karmaProjects: KarmaProject[];

    if (payload.karmaProjectId) {
      const project = await this.getKarmaProject(payload.karmaProjectId);
      karmaProjects = project ? [project] : [];
    } else if (payload.projectId) {
      karmaProjects = await this.getProjectKarmaProjects(payload.projectId);
    } else {
      karmaProjects = await this.getAllKarmaProjects();
    }

    const syncResults = [];

    for (const karmaProject of karmaProjects) {
      if (karmaProject.karmaId) {
        const karmaData = await this.fetchFromKarmaAPI(karmaProject.karmaId);

        // Update local data with Karma data
        if (karmaData) {
          karmaProject.status = karmaData.status;
          karmaProject.grantAmount = karmaData.grantAmount;

          // Update milestones
          for (const karmaMilestone of karmaData.milestones || []) {
            const localMilestone = karmaProject.milestones.find(
              (m) => m.title === karmaMilestone.title
            );
            if (localMilestone) {
              localMilestone.status = karmaMilestone.status;
            }
          }

          karmaProject.syncedAt = new Date().toISOString();
          await this.storeKarmaProject(karmaProject);
        }
      }

      syncResults.push({
        karmaProjectId: karmaProject.karmaProjectId,
        status: "synced",
        syncedAt: karmaProject.syncedAt,
      });
    }

    return {
      projectsSynced: syncResults.length,
      results: syncResults,
    };
  }

  async generateProgressReport(payload: {
    karmaProjectId: string;
  }): Promise<any> {
    const karmaProject = await this.getKarmaProject(payload.karmaProjectId);

    if (!karmaProject) {
      throw new Error("Karma project not found");
    }

    const prompt = `
Generate a comprehensive progress report for this Karma GAP project:

Project: ${karmaProject.title}
Description: ${karmaProject.description}
Status: ${karmaProject.status}
Grant Amount: $${karmaProject.grantAmount || 0}

Milestones:
${karmaProject.milestones
  .map((m) => `- ${m.title} (${m.status}): ${m.description}`)
  .join("\n")}

Create a professional progress report that includes:
1. Executive Summary
2. Milestone Progress
3. Key Achievements
4. Challenges Faced
5. Next Steps
6. Budget Utilization
7. Timeline Assessment

Format the report in markdown with clear sections and bullet points.
  `;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const reportContent = result.content[0].text;

    // Store report
    const reportId = randomUUID();
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `reports/${karmaProject.karmaProjectId}/${reportId}.md`,
        Body: reportContent,
        ContentType: "text/markdown",
      })
    );

    return {
      reportId,
      karmaProjectId: karmaProject.karmaProjectId,
      generatedAt: new Date().toISOString(),
      content: reportContent,
    };
  }

  private async optimizeProjectDescription(
    karmaProject: KarmaProject
  ): Promise<string> {
    const prompt = `
Optimize this project description for a Karma GAP grant application:

Title: ${karmaProject.title}
Current Description: ${karmaProject.description}
Grant Amount: $${karmaProject.grantAmount}

Milestones:
${karmaProject.milestones
  .map((m) => `- ${m.title}: ${m.description}`)
  .join("\n")}

Create an optimized description that:
1. Clearly articulates the problem being solved
2. Explains the solution and its innovation
3. Demonstrates potential impact
4. Shows feasibility and team capability
5. Aligns with public good objectives
6. Is compelling and professional

Keep it concise but comprehensive (max 500 words).
  `;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 800,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.content[0].text;
  }

  private async submitToKarmaAPI(karmaProject: KarmaProject): Promise<any> {
    // TODO: Implement actual Karma GAP API integration
    console.log(`📤 Submitting to Karma GAP: ${karmaProject.title}`);

    // Mock submission result
    return {
      karmaId: `karma_${randomUUID().substring(0, 8)}`,
      applicationUrl: `https://gap.karma.global/projects/karma_${randomUUID().substring(
        0,
        8
      )}`,
      status: "submitted",
    };
  }

  private async fetchFromKarmaAPI(karmaId: string): Promise<any> {
    // TODO: Implement actual Karma GAP API integration
    console.log(`📥 Fetching from Karma GAP: ${karmaId}`);

    // Mock Karma data
    return {
      status: "active",
      grantAmount: 50000,
      milestones: [
        { title: "Project Setup", status: "completed" },
        { title: "Development Phase", status: "in_progress" },
        { title: "Testing & Deployment", status: "pending" },
      ],
    };
  }

  private async syncMilestoneWithKarma(
    karmaProject: KarmaProject,
    milestone: any
  ): Promise<void> {
    // TODO: Sync specific milestone with Karma GAP
    console.log(`🔄 Syncing milestone ${milestone.title} with Karma`);
  }

  private async getKarmaCredentials(): Promise<any> {
    if (this.karmaCredentials) return this.karmaCredentials;

    const response = await this.secrets.send(
      new GetSecretValueCommand({
        SecretId: process.env.KARMA_CREDENTIALS_SECRET!,
      })
    );

    this.karmaCredentials = JSON.parse(response.SecretString!);
    return this.karmaCredentials;
  }

  private async getKarmaProject(
    karmaProjectId: string
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

  private async getProjectKarmaProjects(
    projectId: string
  ): Promise<KarmaProject[]> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.karmaProjectsTableName,
        IndexName: "projectId-index",
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({ ":projectId": projectId }),
      })
    );

    return (response.Items || []).map(
      (item) => unmarshall(item) as KarmaProject
    );
  }

  private async getAllKarmaProjects(): Promise<KarmaProject[]> {
    // TODO: Implement scan with pagination for large datasets
    const response = await this.dynamodb.send(
      new QueryCommand({
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

  private async storeEvidenceFile(
    karmaProjectId: string,
    milestoneId: string,
    fileData: string
  ): Promise<void> {
    const fileId = randomUUID();
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `evidence/${karmaProjectId}/${milestoneId}/${fileId}`,
        Body: fileData,
        ContentType: "application/octet-stream",
      })
    );
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string
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
              result,
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
