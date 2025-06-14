import { Octokit } from "@octokit/rest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { RepositoryService } from "./services/repository";
import { WebhookService } from "./services/webhook";
import { ProjectService } from "../../services/project";
import { TaskService } from "../../services/task";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

type CharacterInfo = {
  name: string;
  personality: string;
};
export class GitHubIntelligenceAgent {
  private octokit: Octokit;
  private dynamodb: DynamoDBClient;
  private bedrock: BedrockRuntimeClient;
  private s3: S3Client;
  private sqsClient: SQSClient;
  private orchestratorQueue: string;
  private repositoryService: RepositoryService;
  private webhookService: WebhookService;
  private projectService: ProjectService;
  private taskService: TaskService;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    this.dynamodb = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.bedrock = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;

    // Initialize services
    this.repositoryService = new RepositoryService(
      this.octokit,
      this.dynamodb,
      this.bedrock,
      this.s3
    );
    this.webhookService = new WebhookService(
      this.octokit,
      this.dynamodb,
      this.sqsClient
    );
    this.projectService = new ProjectService(this.dynamodb);
    this.taskService = new TaskService(
      this.dynamodb,
      this.sqsClient,
      this.orchestratorQueue
    );
  }

  async processTask(task: any): Promise<void> {
    const characterInfo = task.characterInfo;
    let characterResponse = "";

    try {
      let result;
      let analysisResult;

      switch (task.type) {
        case "ANALYZE_REPOSITORY":
          result = await this.repositoryService.analyzeRepository(
            task.payload.repoUrl,
            task.taskId,
            task.workflowId
          );
          break;

        case "ANALYZE_AND_SETUP_PROJECT":
          analysisResult = await this.repositoryService.analyzeRepository(
            task.payload.repoUrl,
            task.taskId,
            task.workflowId
          );
          result = await this.projectService.createProject({
            projectId: task.payload.projectId,
            name: analysisResult.name || "",
            repo: analysisResult.repo,
            developers: analysisResult.developers,
            side: task.payload.side,
            summary: analysisResult.summary,
            technicalSummary: analysisResult.technicalSummary,
            ownerId: task.payload.owner,
          });
          break;

        case "GET_LATEST_COMMITS":
          result = await this.repositoryService.getLatestCommits(task.payload);
          break;

        case "FETCH_REPO_INFO":
          result = await this.repositoryService.fetchRepoInfo(task.payload);
          break;

        case "FETCH_IMPORTANT_FILES":
          result = await this.repositoryService.fetchImportantFilesForProject(
            task.payload
          );
          break;

        case "UPDATE_IMPORTANT_FILES":
          result = await this.repositoryService.updateImportantFiles(
            task.payload
          );
          break;

        case "PROCESS_WEBHOOK":
          result = await this.webhookService.handleWebhook(
            task.payload.body,
            task.taskId,
            task.workflowId
          );
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Generate character response
      if (characterInfo) {
        characterResponse = await this.generateCharacterResponse(
          characterInfo,
          result
        );
      }

      // Report task completion
      if (
        !task.type.includes("ANALYZE_REPOSITORY") &&
        !task.type.includes("PROCESS_WEBHOOK")
      ) {
        await this.taskService.reportTaskCompletion(
          task.taskId,
          task.workflowId,
          {
            ...result,
            characterResponse,
          }
        );
      }
    } catch (error: any) {
      characterResponse = await this.generateErrorResponse(characterInfo);
      await this.taskService.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        null,
        error.message,
        characterResponse
      );
      throw error;
    }
  }
  private async generateCharacterResponse(
    characterInfo: CharacterInfo,
    result: any
  ): Promise<string> {
    const prompt = `You are ${
      characterInfo.name
    }, a character with the following personality: ${characterInfo.personality}
   
   The task has been completed successfully with the following result:
   ${JSON.stringify(result, null, 2)}
   
   Generate a response in character that acknowledges the completion of the task. Keep it brief (1-2 sentences) and stay true to the character's personality and speaking style.`;

    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
      contentType: "application/json",
    });

    try {
      const response = await this.bedrock.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content[0].text.trim();
    } catch (error) {
      console.error("Bedrock character response failed:", error);
      return this.getFallbackCharacterResponse(characterInfo, true);
    }
  }

  private async generateErrorResponse(
    characterInfo: CharacterInfo
  ): Promise<string> {
    const prompt = `You are ${characterInfo.name}, a character with the following personality: ${characterInfo.personality}
   
   A task has failed to complete. Generate a response in character that acknowledges the failure. Keep it brief (1-2 sentences) and stay true to the character's personality and speaking style.`;

    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
      contentType: "application/json",
    });

    try {
      const response = await this.bedrock.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content[0].text.trim();
    } catch (error) {
      console.error("Bedrock error response failed:", error);
      return this.getFallbackCharacterResponse(characterInfo, false);
    }
  }

  private getFallbackCharacterResponse(
    characterInfo: CharacterInfo,
    success: boolean
  ): string {
    if (!characterInfo?.name) return "";

    if (success) {
      return `Task completed successfully by ${characterInfo.name}.`;
    } else {
      return `Task failed. ${characterInfo.name} will try again.`;
    }
  }
}
