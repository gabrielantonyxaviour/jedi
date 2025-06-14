import { Octokit } from "@octokit/rest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { RepositoryService } from "./services/repository";
import { WebhookService } from "./services/webhook";
import { ProjectService } from "../../services/project";
import { TaskService } from "../../services/task";

export class GitHubIntelligenceAgent {
  private octokit: Octokit;
  private dynamodb: DynamoDBClient;
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
    this.s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;

    // Initialize services
    this.repositoryService = new RepositoryService(
      this.octokit,
      this.dynamodb,
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

      switch (task.type) {
        case "ANALYZE_REPOSITORY":
          result = await this.repositoryService.analyzeRepository(
            task.payload.repoUrl,
            task.taskId,
            task.workflowId
          );
          break;

        // case "ANALYZE_AND_SETUP_PROJECT":
        //   result = await this.projectService.analyzeAndSetupProject(
        //     task.payload
        //   );
        //   break;

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
      if (characterInfo?.agentCharacter) {
        characterResponse = this.generateCharacterResponse(
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
      characterResponse = this.generateErrorResponse(characterInfo);
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

  private generateCharacterResponse(characterInfo: any, result: any): string {
    if (characterInfo.side === "light") {
      return "Repository analysis complete, it is. Served you well, I have. The odds of successful deployment are... quite good!";
    }
    return "*mechanical breathing* Your repository has been processed efficiently. The Empire's code standards, it meets.";
  }

  private generateErrorResponse(characterInfo: any): string {
    if (!characterInfo?.agentCharacter) return "";

    return characterInfo.side === "light"
      ? "Failed to complete the task, I have. Most unfortunate, this is."
      : "*mechanical coughing* This failure will not be tolerated. Try again, I must.";
  }
}
