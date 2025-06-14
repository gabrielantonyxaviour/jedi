import { Octokit } from "@octokit/rest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import OpenAI from "openai";
import { RepositoryService } from "./services/repository";
import { WebhookService } from "./services/webhook";
import { ProjectService } from "../../services/project";
import { TaskService } from "../../services/task";

type CharacterInfo = {
  name: string;
  personality: string;
};

export class GitHubIntelligenceAgent {
  private octokit: Octokit;
  private dynamodb: DynamoDBClient;
  private openai: OpenAI;
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
    this.openai = new OpenAI({
      apiKey: process.env.MY_OPENAI_KEY,
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
      this.openai,
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
            `[GitHubIntelligenceAgent] Repository analysis completed with result:`,
            JSON.stringify(result, null, 2)
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
            `[GitHubIntelligenceAgent] Repository analysis completed with result:`,
            JSON.stringify(analysisResult, null, 2)
          );
          console.log(
            `[GitHubIntelligenceAgent] Creating project with data:`,
            JSON.stringify(
              {
                projectId: task.payload.projectId,
                name: analysisResult.name || "",
                repo: analysisResult.repo,
                developers: analysisResult.developers,
                side: task.payload.side,
                summary: analysisResult.summary,
                technicalSummary: analysisResult.technicalSummary,
                ownerId: task.payload.owner,
              },
              null,
              2
            )
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
          console.log(
            `[GitHubIntelligenceAgent] Project created successfully with result:`,
            JSON.stringify(result, null, 2)
          );
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
      `[GitHubIntelligenceAgent] Generating character response with OpenAI`
    );

    const prompt = `You are ${
      characterInfo.name
    }, a character with the following personality: ${characterInfo.personality}
   
   The task has been completed successfully with the following result:
   ${JSON.stringify(result, null, 2)}
   
   Generate a response in character that acknowledges the completion of the task. Keep it brief (1-2 sentences) and stay true to the character's personality and speaking style.`;

    try {
      console.log(`[GitHubIntelligenceAgent] Invoking OpenAI model`);
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const characterText = content.trim();
      console.log(
        `[GitHubIntelligenceAgent] OpenAI character response generated successfully`
      );
      return characterText;
    } catch (error) {
      console.error(
        `[GitHubIntelligenceAgent] OpenAI character response failed:`,
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
    characterInfo?: CharacterInfo
  ): Promise<string> {
    // Add null check
    if (!characterInfo) {
      console.log(
        `[GitHubIntelligenceAgent] No character info available for error response`
      );
      return "Task failed. Please try again.";
    }

    console.log(
      `[GitHubIntelligenceAgent] Generating error response with OpenAI`
    );

    const prompt = `You are ${characterInfo.name}, a character with the following personality: ${characterInfo.personality}
     
     A task has failed to complete. Generate a response in character that acknowledges the failure. Keep it brief (1-2 sentences) and stay true to the character's personality and speaking style.`;

    try {
      console.log(
        `[GitHubIntelligenceAgent] Invoking OpenAI model for error response`
      );
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const errorText = content.trim();
      console.log(
        `[GitHubIntelligenceAgent] OpenAI error response generated successfully`
      );
      return errorText;
    } catch (error) {
      console.error(
        `[GitHubIntelligenceAgent] OpenAI error response failed:`,
        error
      );
      const fallback = this.getFallbackCharacterResponse(characterInfo, false);
      console.log(`[GitHubIntelligenceAgent] Using fallback error response`);
      return fallback;
    }
  }
  private getFallbackCharacterResponse(
    characterInfo?: CharacterInfo,
    success?: boolean
  ): string {
    if (!characterInfo?.name) {
      return success
        ? "Task completed successfully."
        : "Task failed. Please try again.";
    }

    if (success) {
      return `Task completed successfully by ${characterInfo.name}.`;
    } else {
      return `Task failed. ${characterInfo.name} will try again.`;
    }
  }
}
