// github-agent.ts
import { Octokit } from "@octokit/rest";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient } from "@aws-sdk/client-lambda";

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

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    this.dynamodb = new DynamoDBClient({ region: "eu-central-1" });
    this.s3 = new S3Client({ region: "eu-central-1" });
  }

  // Main entry point
  async analyzeRepository(repoUrl: string): Promise<RepoData> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    // Fetch repo data
    const repoInfo = await this.fetchRepositoryInfo(owner, repo);
    const commits = await this.fetchRecentCommits(owner, repo);
    const files = await this.fetchImportantFiles(owner, repo);

    // Generate summary (placeholder for now, will use Bedrock later)
    const summary = this.generateBasicSummary(repoInfo, commits, files);

    // Store in DynamoDB
    await this.storeRepoData(owner, repo, summary);

    // Store detailed data in S3
    await this.storeDetailedData(owner, repo, {
      repoInfo,
      commits,
      files,
    });

    return {
      owner,
      repo,
      lastAnalyzed: new Date().toISOString(),
      summary,
    };
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

  private async storeRepoData(owner: string, repo: string, summary: string) {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: "GitHubRepos",
        Item: {
          repoId: { S: `${owner}/${repo}` },
          summary: { S: summary },
          lastAnalyzed: { S: new Date().toISOString() },
        },
      })
    );
  }

  private async storeDetailedData(owner: string, repo: string, data: any) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: "github-repo-data",
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

  // Webhook handler for real-time updates
  async handleWebhook(webhookData: any): Promise<void> {
    const { repository, commits } = webhookData;
    const owner = repository.owner.login;
    const repo = repository.name;

    // Update repo data when new commits arrive
    // This will trigger re-analysis
    console.log(`New commits in ${owner}/${repo}:`, commits.length);
  }
}

export { GitHubIntelligenceAgent };
