import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";
import { ComplianceScrapingService } from "./service";
import { ComplianceProject } from "../../types/compliance";

export class ComplianceAgent {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private bedrock: BedrockRuntimeClient;
  private sqs: SQSClient;
  private complianceScraper: ComplianceScrapingService;
  private complianceTableName: string;
  private projectsTableName: string;
  private bucketName: string;
  private orchestratorQueue: string;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.complianceScraper = new ComplianceScrapingService();

    this.complianceTableName = process.env.COMPLIANCE_TABLE!;
    this.projectsTableName = process.env.PROJECTS_TABLE_NAME!;
    this.bucketName = process.env.COMPLIANCE_BUCKET!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
  }

  async processTask(task: any): Promise<void> {
    console.log(`🔒 Processing compliance task: ${task.type}`);

    const characterInfo = task.characterInfo;
    let characterResponse = "";

    try {
      let result;

      switch (task.type) {
        case "SCAN_SIMILAR_PROJECTS":
          const similarProjects = await this.scanSimilarProjects(task.payload);
          result = {
            similarProjects,
            count: similarProjects.length,
            flaggedCount: similarProjects.filter((p) => p.similarity > 85)
              .length,
          };
          break;

        case "PROJECT_CREATED_COMPLIANCE_CHECK":
          const complianceResults = await this.checkNewProjectCompliance(
            task.payload
          );
          // Auto-flag high similarity projects
          for (const project of complianceResults.filter(
            (p) => p.similarity > 90
          )) {
            await this.flagProject(project, "High similarity detected");
          }
          result = {
            complianceResults,
            count: complianceResults.length,
          };
          break;

        case "GET_SIMILAR_PROJECTS": // NEW
          const getSimilarResults = await this.getSimilarProjects(task.payload);
          result = { similarProjects: getSimilarResults };
          break;

        case "SEARCH_SIMILAR_PROJECTS": // NEW
          const searchResults = await this.searchSimilarProjects(task.payload);
          result = { searchResults };
          break;

        case "ANALYZE_SIMILARITY":
          const analysis = await this.analyzeSimilarity(task.payload);
          result = { analysis };
          break;

        case "REVIEW_COMPLIANCE":
          const review = await this.reviewCompliance(task.payload);
          result = { review };
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Generate character response
      if (characterInfo?.agentCharacter) {
        if (characterInfo.side === "light") {
          characterResponse =
            "Justice and fairness guide my watch. Your project, protected it shall be. Vigilant against threats, I remain.";
        } else {
          characterResponse =
            "*ignites lightsaber* No mercy for those who dare copy your work. Destroyed, they will be. Fear me, plagiarists must.";
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
            ? "Failed to protect your project, I have. Disappointed in myself, I am."
            : "*mechanical rage* This failure is unacceptable! The Empire demands perfection!";
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
  async getSimilarProjects(payload: {
    projectId: string;
  }): Promise<ComplianceProject[]> {
    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    return await this.scanSimilarProjects({
      projectId: payload.projectId,
      sources: ["all"],
      maxResults: 50,
    });
  }

  async searchSimilarProjects(payload: {
    projectId: string;
    searchTerm: string;
    sources?: string[];
  }): Promise<ComplianceProject[]> {
    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    // Create modified project for targeted search
    const modifiedProject = {
      ...project,
      name: payload.searchTerm,
      description: `${project.description} ${payload.searchTerm}`,
    };

    return await this.complianceScraper.scrapeProjects(
      modifiedProject,
      payload.sources || ["all"],
      50
    );
  }

  // EXISTING METHODS (unchanged)
  async checkNewProjectCompliance(payload: {
    projectId: string;
    projectName: string;
    description: string;
    sources?: string[];
    maxResults?: number;
  }): Promise<ComplianceProject[]> {
    console.log(`🔍 Starting compliance check for: ${payload.projectName}`);

    return await this.scanSimilarProjects({
      projectId: payload.projectId,
      sources: payload.sources || ["all"],
      maxResults: payload.maxResults || 50,
    });
  }

  async scanSimilarProjects(payload: {
    projectId: string;
    sources?: string[];
    maxResults?: number;
  }): Promise<ComplianceProject[]> {
    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    console.log(`🔒 Scanning for similar projects to: ${project.name}`);

    // Scrape similar projects
    const discoveredProjects = await this.complianceScraper.scrapeProjects(
      project,
      payload.sources || ["all"],
      payload.maxResults || 50
    );

    // Analyze similarity for each project
    const analyzedProjects: ComplianceProject[] = [];
    for (const complianceProject of discoveredProjects) {
      const similarity = await this.calculateSimilarity(
        project,
        complianceProject
      );
      const analyzedProject = { ...complianceProject, similarity };

      await this.storeComplianceProject(analyzedProject);
      analyzedProjects.push(analyzedProject);
    }

    console.log(
      `✅ Found and analyzed ${analyzedProjects.length} similar projects`
    );
    return analyzedProjects.sort((a, b) => b.similarity - a.similarity);
  }

  private async calculateSimilarity(
    originalProject: any,
    complianceProject: ComplianceProject
  ): Promise<number> {
    const prompt = `
Compare these two projects and calculate similarity (0-100):

Original Project:
- Name: ${originalProject.name}
- Description: ${originalProject.description}

Comparison Project:
- Name: ${complianceProject.projectName}
- Description: ${complianceProject.description}
- Platform: ${complianceProject.platform}
- Tags: ${complianceProject.tags.join(", ")}

Analyze similarity based on:
1. Name similarity (exact matches, similar words)
2. Description/concept similarity
3. Technical approach/implementation
4. Overall functionality and purpose
5. Unique features vs common features

Consider:
- Exact name matches = very high similarity
- Similar concepts with different implementations = medium similarity  
- Common hackathon themes = lower weight
- Generic project names = lower similarity

Return only a number between 0-100 representing similarity percentage.
`;

    try {
      const response = await this.bedrock.send(
        new InvokeModelCommand({
          modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
          body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 100,
          }),
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.body));
      const similarityText = result.content[0].text.trim();
      const similarity = parseInt(similarityText.match(/\d+/)?.[0] || "50");

      return Math.max(0, Math.min(100, similarity));
    } catch (error) {
      console.error("Error calculating similarity:", error);
      return 50; // Default moderate similarity
    }
  }

  async analyzeSimilarity(payload: { complianceId: string }): Promise<any> {
    const complianceProject = await this.getComplianceProject(
      payload.complianceId
    );
    const originalProject = await this.getProject(
      complianceProject.originalProjectId
    );

    const prompt = `
Provide detailed similarity analysis between these projects:

Original Project:
- Name: ${originalProject.name}
- Description: ${originalProject.description}

Similar Project Found:
- Name: ${complianceProject.projectName}
- Description: ${complianceProject.description}
- Platform: ${complianceProject.platform}
- URL: ${complianceProject.url}
- Similarity Score: ${complianceProject.similarity}%

Provide detailed analysis:
1. What makes them similar?
2. Key differences
3. Potential compliance concerns
4. Recommendation (flag, investigate, clear)
5. Specific areas of concern

Format as JSON with fields: similarities, differences, concerns, recommendation, riskLevel
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
    const analysis = JSON.parse(result.content[0].text);

    // Update compliance project with analysis
    await this.updateComplianceProject({
      ...complianceProject,
      metadata: { ...complianceProject.metadata, analysis },
    });

    return analysis;
  }

  async reviewCompliance(payload: {
    complianceId: string;
    action: "flag" | "clear" | "investigate";
    reason?: string;
  }): Promise<any> {
    const complianceProject = await this.getComplianceProject(
      payload.complianceId
    );

    const updatedProject: ComplianceProject = {
      ...complianceProject,
      status:
        payload.action === "flag"
          ? "flagged"
          : payload.action === "clear"
          ? "cleared"
          : "reviewed",
      reviewedAt: new Date().toISOString(),
      flagReason: payload.action === "flag" ? payload.reason : undefined,
    };

    await this.updateComplianceProject(updatedProject);

    // If flagged, notify the user
    if (payload.action === "flag") {
      await this.notifyComplianceIssue(updatedProject);
    }

    return {
      complianceId: payload.complianceId,
      action: payload.action,
      status: updatedProject.status,
      reviewedAt: updatedProject.reviewedAt,
    };
  }

  private async flagProject(
    project: ComplianceProject,
    reason: string
  ): Promise<void> {
    console.log(`🚩 Auto-flagging project: ${project.projectName} - ${reason}`);

    await this.updateComplianceProject({
      ...project,
      status: "flagged",
      flagReason: reason,
      reviewedAt: new Date().toISOString(),
    });

    await this.notifyComplianceIssue(project);
  }

  private async notifyComplianceIssue(
    project: ComplianceProject
  ): Promise<void> {
    const originalProject = await this.getProject(project.originalProjectId);

    try {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: process.env.EMAIL_QUEUE_URL!,
          MessageBody: JSON.stringify({
            type: "COMPLIANCE_ALERT",
            taskId: randomUUID(),
            workflowId: randomUUID(),
            payload: {
              userEmail: originalProject.email,
              userName: originalProject.userName,
              projectName: originalProject.name,
              similarProject: {
                name: project.projectName,
                platform: project.platform,
                url: project.url,
                similarity: project.similarity,
                reason: project.flagReason,
                discoveredAt: project.discoveredAt,
              },
            },
          }),
        })
      );

      console.log(`✅ Compliance alert sent for ${project.projectName}`);
    } catch (error) {
      console.error("Failed to send compliance alert:", error);
    }
  }

  // Helper methods
  private async getProject(projectId: string): Promise<any> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.projectsTableName,
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({ ":projectId": projectId }),
      })
    );

    return response.Items ? unmarshall(response.Items[0]) : null;
  }

  private async getComplianceProject(
    complianceId: string
  ): Promise<ComplianceProject> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.complianceTableName,
        KeyConditionExpression: "complianceId = :complianceId",
        ExpressionAttributeValues: marshall({ ":complianceId": complianceId }),
      })
    );

    return response.Items
      ? (unmarshall(response.Items[0]) as ComplianceProject)
      : null!;
  }

  private async storeComplianceProject(
    project: ComplianceProject
  ): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.complianceTableName,
        Item: marshall(project),
      })
    );
  }

  private async updateComplianceProject(
    project: ComplianceProject
  ): Promise<void> {
    await this.storeComplianceProject(project);
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
              agent: "compliance",
            },
          }),
        })
      );
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}
