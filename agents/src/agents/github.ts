// github-agent.ts
import { Octokit } from "@octokit/rest";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

interface RepoData {
  owner: string;
  repo: string;
  lastAnalyzed: string;
  summary?: string;
}

class GitHubIntelligenceAgent {
  private octokit: Octokit;
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private sqsClient: SQSClient;
  private orchestratorQueue: string;

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
  }

  // UPDATED processTask method for new task types
  async processTask(task: any): Promise<void> {
    const characterInfo = task.characterInfo;
    let characterResponse = "";

    try {
      let result;

      switch (task.type) {
        case "ANALYZE_REPOSITORY":
          result = await this.analyzeRepository(
            task.payload.repoUrl,
            task.taskId,
            task.workflowId
          );
          break;

        case "ANALYZE_AND_SETUP_PROJECT": // NEW
          result = await this.analyzeAndSetupProject(task.payload);
          break;

        case "GET_LATEST_COMMITS": // NEW
          result = await this.getLatestCommits(task.payload);
          break;

        case "FETCH_REPO_INFO": // NEW
          result = await this.fetchRepoInfo(task.payload);
          break;

        case "FETCH_IMPORTANT_FILES": // NEW
          result = await this.fetchImportantFilesForProject(task.payload);
          break;

        case "UPDATE_IMPORTANT_FILES": // NEW
          result = await this.updateImportantFiles(task.payload);
          break;

        case "PROCESS_WEBHOOK":
          result = await this.handleWebhook(
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
        if (characterInfo.side === "light") {
          characterResponse =
            "Repository analysis complete, it is. Served you well, I have. The odds of successful deployment are... quite good!";
        } else {
          characterResponse =
            "*mechanical breathing* Your repository has been processed efficiently. The Empire's code standards, it meets.";
        }
      }

      // Don't call reportTaskCompletion here if it's already called in the methods above
      if (
        !task.type.includes("ANALYZE_REPOSITORY") &&
        !task.type.includes("PROCESS_WEBHOOK")
      ) {
        await this.reportTaskCompletion(task.taskId, task.workflowId, {
          ...result,
          characterResponse,
        });
      }
    } catch (error: any) {
      if (characterInfo?.agentCharacter) {
        characterResponse =
          characterInfo.side === "light"
            ? "Failed to complete the task, I have. Most unfortunate, this is."
            : "*mechanical coughing* This failure will not be tolerated. Try again, I must.";
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
  async analyzeAndSetupProject(payload: any): Promise<any> {
    const repoAnalysis = await this.analyzeRepository(payload.repoUrl);

    // Extract project info and store with character context
    const projectInfo = {
      projectId: payload.projectId,
      name: this.extractProjectName(payload.repoUrl),
      description: repoAnalysis.summary,
      githubUrl: payload.repoUrl,
      side: payload.side,
      walletAddress: payload.walletAddress,
      createdAt: new Date().toISOString(),
    };

    // Store in projects table
    await this.storeProject(projectInfo);

    return {
      projectInfo,
      repoAnalysis,
      characterName: payload.characterName,
    };
  }

  async getLatestCommits(payload: {
    projectId: string;
    count?: number;
  }): Promise<any> {
    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const { owner, repo } = this.parseRepoUrl(project.githubUrl);
    return await this.fetchRecentCommits(owner, repo, payload.count || 10);
  }

  async fetchRepoInfo(payload: { projectId: string }): Promise<any> {
    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const { owner, repo } = this.parseRepoUrl(project.githubUrl);
    return await this.fetchRepositoryInfo(owner, repo);
  }

  async fetchImportantFilesForProject(payload: {
    projectId: string;
  }): Promise<any> {
    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const { owner, repo } = this.parseRepoUrl(project.githubUrl);
    return await this.fetchImportantFiles(owner, repo);
  }

  async updateImportantFiles(payload: {
    projectId: string;
    files: any[];
  }): Promise<any> {
    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const { owner, repo } = this.parseRepoUrl(project.githubUrl);

    const results = [];
    for (const file of payload.files) {
      try {
        // Update file via GitHub API
        const result = await this.updateFile(
          owner,
          repo,
          file.path,
          file.content,
          file.message
        );
        results.push(result);
      } catch (error: any) {
        console.error(`Failed to update file ${file.path}:`, error);
        results.push({ path: file.path, error: error.message });
      }
    }

    return { updatedFiles: results };
  }

  private async updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string
  ): Promise<any> {
    // First get the current file to get its SHA
    try {
      const { data: currentFile } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      // Update the file
      const { data } = await this.octokit.rest.repos.createOrUpdateFileContents(
        {
          owner,
          repo,
          path,
          message,
          content: Buffer.from(content).toString("base64"),
          sha: Array.isArray(currentFile) ? undefined : currentFile.sha,
        }
      );

      return {
        path,
        sha: data.commit.sha,
        message,
        updated: true,
      };
    } catch (error) {
      // If file doesn't exist, create it
      const { data } = await this.octokit.rest.repos.createOrUpdateFileContents(
        {
          owner,
          repo,
          path,
          message,
          content: Buffer.from(content).toString("base64"),
        }
      );

      return {
        path,
        sha: data.commit.sha,
        message,
        created: true,
      };
    }
  }

  private extractProjectName(repoUrl: string): string {
    const { repo } = this.parseRepoUrl(repoUrl);
    return repo.charAt(0).toUpperCase() + repo.slice(1);
  }

  private async storeProject(project: any): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: process.env.PROJECTS_TABLE_NAME || "projects",
        Item: marshall(project),
      })
    );
  }

  private async getProject(projectId: string): Promise<any> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: process.env.PROJECTS_TABLE_NAME || "projects",
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({ ":projectId": projectId }),
      })
    );

    return response.Items ? unmarshall(response.Items[0]) : null;
  }

  // EXISTING METHODS (unchanged)
  async analyzeRepository(
    repoUrl: string,
    taskId?: string,
    workflowId?: string
  ): Promise<RepoData> {
    try {
      const { owner, repo } = this.parseRepoUrl(repoUrl);

      // Fetch repo data
      const repoInfo = await this.fetchRepositoryInfo(owner, repo);
      const commits = await this.fetchRecentCommits(owner, repo);
      const files = await this.fetchImportantFiles(owner, repo);

      // Generate summary
      const summary = this.generateBasicSummary(repoInfo, commits, files);

      // Store in DynamoDB
      await this.storeRepoData(owner, repo, summary);

      // Store detailed data in S3
      await this.storeDetailedData(owner, repo, {
        repoInfo,
        commits,
        files,
      });

      const result = {
        owner,
        repo,
        lastAnalyzed: new Date().toISOString(),
        summary,
      };

      if (taskId && workflowId) {
        await this.reportTaskCompletion(taskId, workflowId, result);
      }

      return result;
    } catch (error: any) {
      if (taskId && workflowId) {
        await this.reportTaskCompletion(
          taskId,
          workflowId,
          null,
          error.message
        );
      }
      throw error;
    }
  }

  async getRepoData(owner: string, repo: string): Promise<RepoData> {
    const response = await this.dynamodb.send(
      new GetItemCommand({
        TableName: process.env.GITHUB_PROJECTS_TABLE || "github-projects",
        Key: {
          projectId: { S: `${owner}/${repo}` },
        },
      })
    );
    if (response.Item) {
      return {
        owner: response.Item.owner.S || "",
        repo: response.Item.projectId.S || "",
        summary: response.Item.summary.S,
        lastAnalyzed: response.Item.lastAnalyzed.S || "",
      };
    } else {
      return {
        owner: "",
        repo: "",
        summary: "",
        lastAnalyzed: "",
      };
    }
  }

  private async fetchRepositoryInfo(owner: string, repo: string) {
    const { data } = await this.octokit.rest.repos.get({ owner, repo });
    return {
      name: data.name,
      description: data.description,
      language: data.language,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private async fetchRecentCommits(owner: string, repo: string, count = 10) {
    const { data } = await this.octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: count,
    });

    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name,
      date: commit.commit.author?.date,
      additions: commit.stats?.additions,
      deletions: commit.stats?.deletions,
    }));
  }

  private async fetchImportantFiles(owner: string, repo: string) {
    const importantFiles = [
      "README.md",
      "package.json",
      "requirements.txt",
      "Cargo.toml",
    ];
    const files = [];

    for (const filename of importantFiles) {
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path: filename,
        });

        if ("content" in data) {
          files.push({
            name: filename,
            content: Buffer.from(data.content, "base64").toString("utf8"),
          });
        }
      } catch (error) {
        // File doesn't exist, skip
      }
    }

    return files;
  }

  private generateBasicSummary(
    repoInfo: any,
    commits: any[],
    files: any[]
  ): string {
    // Basic rule-based summary (will replace with Bedrock later)
    const recentActivity =
      commits.length > 0
        ? `Last commit: ${commits[0].message} by ${commits[0].author}`
        : "No recent commits";

    const techStack = this.extractTechStack(files);

    return `
Project: ${repoInfo.name}
Description: ${repoInfo.description || "No description"}
Language: ${repoInfo.language}
Stars: ${repoInfo.stars}
Tech Stack: ${techStack.join(", ")}
Recent Activity: ${recentActivity}
    `.trim();
  }

  private extractTechStack(files: any[]): string[] {
    const stack: string[] = [];

    files.forEach((file) => {
      if (file.name === "package.json") stack.push("Node.js");
      if (file.name === "requirements.txt") stack.push("Python");
      if (file.name === "Cargo.toml") stack.push("Rust");
    });

    return stack;
  }

  private async storeRepoData(
    owner: string,
    repo: string,
    summary: string,
    webhookUrl?: string
  ) {
    const item: any = {
      projectId: { S: `${owner}/${repo}` },
      owner: { S: owner },
      summary: { S: summary },
      lastAnalyzed: { S: new Date().toISOString() },
    };

    if (webhookUrl) {
      item.webhookUrl = { S: webhookUrl };
      item.webhookStatus = { S: "active" };
    }

    await this.dynamodb.send(
      new PutItemCommand({
        TableName: process.env.GITHUB_PROJECTS_TABLE || "github-projects",
        Item: item,
      })
    );
  }

  private async storeDetailedData(owner: string, repo: string, data: any) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: process.env.GITHUB_BUCKET || "github-intelligence-data-jedi-v0",
        Key: `${owner}/${repo}/analysis.json`,
        Body: JSON.stringify(data),
        ContentType: "application/json",
      })
    );
  }

  private parseRepoUrl(url: string): { owner: string; repo: string } {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error("Invalid GitHub URL");
    return { owner: match[1], repo: match[2].replace(".git", "") };
  }

  async handleWebhook(
    webhookData: any,
    taskId?: string,
    workflowId?: string
  ): Promise<void> {
    try {
      const { repository, commits, action, pull_request, issue, release } =
        webhookData;
      const owner = repository.owner.login;
      const repo = repository.name;

      console.log(`🔔 Webhook received for ${owner}/${repo}:`, {
        action,
        commits: commits?.length || 0,
        pullRequest: !!pull_request,
        issue: !!issue,
        release: !!release,
      });

      // Process different webhook events
      if (commits && commits.length > 0) {
        await this.processNewCommits(owner, repo, commits);
      }

      if (pull_request) {
        await this.processPullRequest(owner, repo, pull_request, action);
      }

      if (release) {
        await this.processRelease(owner, repo, release, action);
      }

      // Report task completion if this was triggered by orchestrator
      if (taskId && workflowId) {
        await this.reportTaskCompletion(taskId, workflowId, {
          owner,
          repo,
          action,
          processed: true,
          commits: commits?.length || 0,
          pullRequest: !!pull_request,
          issue: !!issue,
          release: !!release,
        });
      }
    } catch (error: any) {
      if (taskId && workflowId) {
        await this.reportTaskCompletion(
          taskId,
          workflowId,
          null,
          error.message
        );
      }
      throw error;
    }
  }

  private async processNewCommits(owner: string, repo: string, commits: any[]) {
    console.log(
      `📝 Processing ${commits.length} new commits for ${owner}/${repo}`
    );

    // Update last activity
    await this.updateLastActivity(owner, repo, "commits", commits.length);

    // Optionally trigger re-analysis for significant changes
    const significantCommits = commits.filter(
      (commit) => commit.added?.length > 5 || commit.modified?.length > 10
    );

    if (significantCommits.length > 0) {
      console.log(
        `🔄 Triggering re-analysis due to ${significantCommits.length} significant commits`
      );
      // Could trigger partial re-analysis here
    }
  }

  private async updateLastActivity(
    owner: string,
    repo: string,
    type: string,
    count: number
  ) {
    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: process.env.GITHUB_PROJECTS_TABLE || "github-projects",
        Key: {
          projectId: { S: `${owner}/${repo}` },
        },
        UpdateExpression:
          "SET lastActivity = :activity, lastActivityTime = :time",
        ExpressionAttributeValues: {
          ":activity": { S: `${type}: ${count}` },
          ":time": { S: new Date().toISOString() },
        },
      })
    );
  }

  private async processPullRequest(
    owner: string,
    repo: string,
    pullRequest: any,
    action: string
  ) {
    console.log(`🔃 Processing pull request ${action} for ${owner}/${repo}:`, {
      number: pullRequest.number,
      title: pullRequest.title,
      state: pullRequest.state,
      mergeable: pullRequest.mergeable,
    });

    // Update last activity
    await this.updateLastActivity(owner, repo, `pr_${action}`, 1);

    // Handle different PR actions
    switch (action) {
      case "opened":
        // New PR analysis could be triggered here
        console.log(`📝 New PR opened: #${pullRequest.number}`);
        break;
      case "closed":
        if (pullRequest.merged) {
          console.log(`✅ PR merged: #${pullRequest.number}`);
          // Could trigger re-analysis after merge
        } else {
          console.log(`❌ PR closed without merge: #${pullRequest.number}`);
        }
        break;
      case "synchronize":
        console.log(`🔄 PR updated: #${pullRequest.number}`);
        break;
    }
  }

  private async processRelease(
    owner: string,
    repo: string,
    release: any,
    action: string
  ) {
    console.log(`🚀 Processing release ${action} for ${owner}/${repo}:`, {
      tagName: release.tag_name,
      name: release.name,
      prerelease: release.prerelease,
      draft: release.draft,
    });

    // Update last activity
    await this.updateLastActivity(owner, repo, `release_${action}`, 1);

    // Handle different release actions
    switch (action) {
      case "published":
        console.log(`📦 New release published: ${release.tag_name}`);
        // Could trigger comprehensive analysis for new releases
        break;
      case "created":
        console.log(`📝 Release created: ${release.tag_name}`);
        break;
      case "edited":
        console.log(`✏️ Release edited: ${release.tag_name}`);
        break;
    }
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string,
    characterResponse?: string
  ) {
    try {
      const completion = {
        taskId,
        workflowId,
        status: error ? "FAILED" : "COMPLETED",
        result: result ? { ...result, characterResponse } : null,
        error,
        timestamp: new Date().toISOString(),
        agent: "github-intelligence",
      };

      await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: this.orchestratorQueue,
          MessageBody: JSON.stringify({
            type: "TASK_COMPLETION",
            payload: completion,
          }),
        })
      );
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}

export { GitHubIntelligenceAgent };
