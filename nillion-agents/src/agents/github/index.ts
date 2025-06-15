import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import { RepositoryService } from "./services/repository";
import { WebhookService } from "./services/webhook";
import {
  pushLogs,
  pushGithub,
  fetchGithub,
  pushCreating,
  fetchCreatingByAddress,
} from "../../services/nillion";
import { LogsData, GithubData } from "../../types/nillion";

type CharacterInfo = {
  name: string;
  personality: string;
};

export class GitHubIntelligenceAgent {
  private octokit: Octokit;
  private openai: OpenAI;
  private repositoryService: RepositoryService;
  private webhookService: WebhookService;
  private agentName: string = "github-intelligence-agent";

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    this.openai = new OpenAI({
      apiKey: process.env.MY_OPENAI_KEY,
    });

    // Initialize services
    this.repositoryService = new RepositoryService(this.octokit, this.openai);
    this.webhookService = new WebhookService(this.octokit);
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
            task.payload.ownerAddress,
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
            task.payload.ownerAddress,
            task.taskId,
            task.workflowId
          );

          result = await this.createProject({
            projectId: task.payload.projectId,
            name: analysisResult.name || "",
            repoUrl: task.payload.repoUrl,
            ownerAddress: task.payload.ownerAddress,
            side: task.payload.side,
            summary: analysisResult.summary || "",
            technicalSummary: analysisResult.technicalSummary || "",
            developers: analysisResult.developers,
          });
          console.log(`[GitHubIntelligenceAgent] Project created successfully`);
          break;

        case "GET_LATEST_COMMITS":
          console.log(`[GitHubIntelligenceAgent] Getting latest commits`);
          result = await this.repositoryService.getLatestCommits(task.payload);
          break;

        case "FETCH_REPO_INFO":
          console.log(`[GitHubIntelligenceAgent] Fetching repo info`);
          result = await this.repositoryService.fetchRepoInfo(task.payload);
          break;

        case "FETCH_IMPORTANT_FILES":
          console.log(
            `[GitHubIntelligenceAgent] Fetching important files for project`
          );
          result = await this.repositoryService.fetchImportantFilesForProject(
            task.payload
          );
          break;

        case "UPDATE_IMPORTANT_FILES":
          console.log(`[GitHubIntelligenceAgent] Updating important files`);
          result = await this.repositoryService.updateImportantFiles(
            task.payload
          );
          break;

        case "PROCESS_WEBHOOK":
          console.log(`[GitHubIntelligenceAgent] Processing webhook`);
          result = await this.webhookService.handleWebhook(
            task.payload.body,
            task.payload.ownerAddress,
            task.taskId,
            task.workflowId
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
      }

      // Report task completion via logs
      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        task.payload.ownerAddress || "system",
        {
          ...result,
          characterResponse,
        }
      );

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

      characterResponse = await this.generateErrorResponse(characterInfo);

      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        task.payload.ownerAddress || "system",
        null,
        error.message,
        characterResponse
      );

      throw error;
    }
  }

  private async createProject(data: {
    projectId: string;
    name: string;
    repoUrl: string;
    ownerAddress: string;
    side?: string;
    summary: string;
    technicalSummary: string;
    developers: any[];
  }): Promise<any> {
    const { owner, repo } = this.parseRepoUrl(data.repoUrl);

    // Store in GitHub collection
    await pushGithub({
      name: data.name,
      description: data.summary,
      technical_description: data.technicalSummary,
      repo_url: data.repoUrl,
      owner: owner,
      collab: data.developers.map((d) => d.github_username).join(","),
      owner_address: data.ownerAddress,
      metadata: JSON.stringify({
        projectId: data.projectId,
        side: data.side,
        developers: data.developers,
        createdAt: new Date().toISOString(),
      }),
    });

    // Update creating collection to mark github step as complete
    await pushCreating({
      address: data.ownerAddress,
      init_step: "setup", // Move to next step
    });

    return {
      projectId: data.projectId,
      name: data.name,
      repoUrl: data.repoUrl,
      summary: data.summary,
      technicalSummary: data.technicalSummary,
      developers: data.developers,
    };
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

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      return (
        content?.trim() ||
        this.getFallbackCharacterResponse(characterInfo, true)
      );
    } catch (error) {
      console.error(
        `[GitHubIntelligenceAgent] OpenAI character response failed:`,
        error
      );
      return this.getFallbackCharacterResponse(characterInfo, true);
    }
  }

  private async generateErrorResponse(
    characterInfo?: CharacterInfo
  ): Promise<string> {
    if (!characterInfo) {
      return "Task failed. Please try again.";
    }

    const prompt = `You are ${characterInfo.name}, a character with the following personality: ${characterInfo.personality}
     
     A task has failed to complete. Generate a response in character that acknowledges the failure. Keep it brief (1-2 sentences) and stay true to the character's personality and speaking style.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      return (
        content?.trim() ||
        this.getFallbackCharacterResponse(characterInfo, false)
      );
    } catch (error) {
      return this.getFallbackCharacterResponse(characterInfo, false);
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

  async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    ownerAddress: string,
    result?: any,
    error?: string,
    characterResponse?: string
  ): Promise<void> {
    try {
      await pushLogs({
        owner_address: ownerAddress,
        project_id: workflowId,
        agent_name: this.agentName,
        text: error
          ? `Task ${taskId} failed: ${error}`
          : `Task ${taskId} completed successfully`,
        data: JSON.stringify({
          type: "TASK_COMPLETION",
          payload: {
            taskId,
            workflowId,
            status: error ? "FAILED" : "COMPLETED",
            result: result ? { ...result, characterResponse } : null,
            error,
            timestamp: new Date().toISOString(),
            agent: "github-intelligence",
          },
        }),
      });
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }

  private parseRepoUrl(url: string): { owner: string; repo: string } {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error("Invalid GitHub repository URL");
    return { owner: match[1], repo: match[2] };
  }
}
