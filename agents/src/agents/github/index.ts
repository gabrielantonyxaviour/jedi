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
    console.log(`[GitHubIntelligenceAgent] Starting task processing:`, {
      taskId: task.taskId,
      workflowId: task.workflowId,
      type: task.type,
      hasCharacterInfo: !!task.characterInfo,
    });

    const characterInfo = task.characterInfo;
    let characterResponse = "";

    try {
      let result;
      let analysisResult;

      console.log(
        `[GitHubIntelligenceAgent] Processing task type: ${task.type}`
      );

      switch (task.type) {
        case "ANALYZE_REPOSITORY":
          console.log(
            `[GitHubIntelligenceAgent] Analyzing repository:`,
            task.payload.repoUrl
          );
          result = await this.repositoryService.analyzeRepository(
            task.payload.repoUrl,
            task.taskId,
            task.workflowId
          );
          console.log(
            `[GitHubIntelligenceAgent] Repository analysis completed`
          );
          break;

        case "ANALYZE_AND_SETUP_PROJECT":
          console.log(
            `[GitHubIntelligenceAgent] Analyzing and setting up project:`,
            task.payload.repoUrl
          );
          analysisResult = await this.repositoryService.analyzeRepository(
            task.payload.repoUrl,
            task.taskId,
            task.workflowId
          );
          console.log(
            `[GitHubIntelligenceAgent] Repository analysis completed, creating project`
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
          console.log(`[GitHubIntelligenceAgent] Project created successfully`);
          break;

        case "GET_LATEST_COMMITS":
          console.log(`[GitHubIntelligenceAgent] Getting latest commits`);
          result = await this.repositoryService.getLatestCommits(task.payload);
          console.log(`[GitHubIntelligenceAgent] Latest commits retrieved`);
          break;

        case "FETCH_REPO_INFO":
          console.log(`[GitHubIntelligenceAgent] Fetching repo info`);
          result = await this.repositoryService.fetchRepoInfo(task.payload);
          console.log(
            `[GitHubIntelligenceAgent] Repo info fetched successfully`
          );
          break;

        case "FETCH_IMPORTANT_FILES":
          console.log(
            `[GitHubIntelligenceAgent] Fetching important files for project`
          );
          result = await this.repositoryService.fetchImportantFilesForProject(
            task.payload
          );
          console.log(`[GitHubIntelligenceAgent] Important files fetched`);
          break;

        case "UPDATE_IMPORTANT_FILES":
          console.log(`[GitHubIntelligenceAgent] Updating important files`);
          result = await this.repositoryService.updateImportantFiles(
            task.payload
          );
          console.log(`[GitHubIntelligenceAgent] Important files updated`);
          break;

        case "PROCESS_WEBHOOK":
          console.log(`[GitHubIntelligenceAgent] Processing webhook`);
          result = await this.webhookService.handleWebhook(
            task.payload.body,
            task.taskId,
            task.workflowId
          );
          console.log(
            `[GitHubIntelligenceAgent] Webhook processed successfully`
          );
          break;

        default:
          console.error(
            `[GitHubIntelligenceAgent] Unknown task type: ${task.type}`
          );
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Generate character response
      if (characterInfo) {
        console.log(
          `[GitHubIntelligenceAgent] Generating character response for: ${characterInfo.name}`
        );
        characterResponse = await this.generateCharacterResponse(
          characterInfo,
          result
        );
        console.log(`[GitHubIntelligenceAgent] Character response generated`);
      }

      // Report task completion
      if (
        !task.type.includes("ANALYZE_REPOSITORY") &&
        !task.type.includes("PROCESS_WEBHOOK")
      ) {
        console.log(`[GitHubIntelligenceAgent] Reporting task completion`);
        await this.taskService.reportTaskCompletion(
          task.taskId,
          task.workflowId,
          {
            ...result,
            characterResponse,
          }
        );
        console.log(
          `[GitHubIntelligenceAgent] Task completion reported successfully`
        );
      } else {
        console.log(
          `[GitHubIntelligenceAgent] Skipping task completion report for type: ${task.type}`
        );
      }

      console.log(
        `[GitHubIntelligenceAgent] Task processing completed successfully`
      );
    } catch (error: any) {
      console.error(`[GitHubIntelligenceAgent] Task processing failed:`, {
        taskId: task.taskId,
        workflowId: task.workflowId,
        type: task.type,
        error: error.message,
        stack: error.stack,
      });

      console.log(`[GitHubIntelligenceAgent] Generating error response`);
      characterResponse = await this.generateErrorResponse(characterInfo);

      console.log(`[GitHubIntelligenceAgent] Reporting task failure`);
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
    console.log(
      `[GitHubIntelligenceAgent] Generating character response with Bedrock`
    );

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
      console.log(`[GitHubIntelligenceAgent] Invoking Bedrock model`);
      const response = await this.bedrock.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const characterText = responseBody.content[0].text.trim();
      console.log(
        `[GitHubIntelligenceAgent] Bedrock character response generated successfully`
      );
      return characterText;
    } catch (error) {
      console.error(
        `[GitHubIntelligenceAgent] Bedrock character response failed:`,
        error
      );
      const fallback = this.getFallbackCharacterResponse(characterInfo, true);
      console.log(
        `[GitHubIntelligenceAgent] Using fallback character response`
      );
      return fallback;
    }
  }

  private async generateErrorResponse(
    characterInfo: CharacterInfo
  ): Promise<string> {
    console.log(
      `[GitHubIntelligenceAgent] Generating error response with Bedrock`
    );

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
      console.log(
        `[GitHubIntelligenceAgent] Invoking Bedrock model for error response`
      );
      const response = await this.bedrock.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const errorText = responseBody.content[0].text.trim();
      console.log(
        `[GitHubIntelligenceAgent] Bedrock error response generated successfully`
      );
      return errorText;
    } catch (error) {
      console.error(
        `[GitHubIntelligenceAgent] Bedrock error response failed:`,
        error
      );
      const fallback = this.getFallbackCharacterResponse(characterInfo, false);
      console.log(`[GitHubIntelligenceAgent] Using fallback error response`);
      return fallback;
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
