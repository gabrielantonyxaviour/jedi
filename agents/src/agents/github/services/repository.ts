import { Octokit } from "@octokit/rest";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

interface RepoData {
  owner: string;
  repo: string;
  lastAnalyzed: string;
  summary?: string;
}

interface Project {
  projectId: string;
  githubUrl: string;
}

interface FileContent {
  type: string;
  name: string;
  path: string;
  sha: string;
  content?: string;
}

export class RepositoryService {
  constructor(
    private octokit: Octokit,
    private dynamodb: DynamoDBClient,
    private s3: S3Client
  ) {}

  async analyzeRepository(
    repoUrl: string,
    taskId?: string,
    workflowId?: string
  ): Promise<RepoData> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const repoInfo = await this.fetchRepositoryInfo(owner, repo);
    const commits = await this.fetchRecentCommits(owner, repo);
    const files = await this.fetchImportantFiles(owner, repo);

    const summary = this.generateBasicSummary(repoInfo, commits, files);
    await this.storeRepoData(owner, repo, summary);

    return {
      owner,
      repo,
      lastAnalyzed: new Date().toISOString(),
      summary,
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
    files: Array<{ path: string; content: string; message: string }>;
  }): Promise<any> {
    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const { owner, repo } = this.parseRepoUrl(project.githubUrl);
    const results = [];

    for (const file of payload.files) {
      const result = await this.updateFile(
        owner,
        repo,
        file.path,
        file.content,
        file.message
      );
      results.push(result);
    }

    return results;
  }

  private async fetchRepositoryInfo(owner: string, repo: string) {
    const response = await this.octokit.repos.get({
      owner,
      repo,
    });
    return response.data;
  }

  private async fetchRecentCommits(owner: string, repo: string, count = 10) {
    const response = await this.octokit.repos.listCommits({
      owner,
      repo,
      per_page: count,
    });
    return response.data;
  }

  private async fetchImportantFiles(
    owner: string,
    repo: string
  ): Promise<FileContent[]> {
    const importantFiles = [
      "README.md",
      "package.json",
      "requirements.txt",
      "Dockerfile",
      ".gitignore",
    ];

    const files: FileContent[] = [];
    for (const file of importantFiles) {
      try {
        const response = await this.octokit.repos.getContent({
          owner,
          repo,
          path: file,
        });
        if ("type" in response.data && "name" in response.data) {
          files.push(response.data as FileContent);
        }
      } catch (error) {
        // File doesn't exist, skip it
      }
    }

    return files;
  }

  private async updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string
  ): Promise<any> {
    try {
      // Get the current file if it exists
      let currentFile: FileContent | undefined;
      try {
        const response = await this.octokit.repos.getContent({
          owner,
          repo,
          path,
        });
        if ("type" in response.data && "name" in response.data) {
          currentFile = response.data as FileContent;
        }
      } catch (error) {
        // File doesn't exist, that's okay
      }

      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString("base64"),
        sha: currentFile?.sha,
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to update file ${path}: ${error.message}`);
    }
  }

  private generateBasicSummary(
    repoInfo: any,
    commits: any[],
    files: FileContent[]
  ): string {
    const techStack = this.extractTechStack(files);
    const lastCommit = commits[0];
    const lastCommitDate = new Date(
      lastCommit?.commit?.author?.date || ""
    ).toLocaleDateString();

    return `
Repository: ${repoInfo.name}
Description: ${repoInfo.description || "No description provided"}
Stars: ${repoInfo.stargazers_count}
Forks: ${repoInfo.forks_count}
Last Commit: ${lastCommitDate}
Tech Stack: ${techStack.join(", ")}
    `.trim();
  }

  private extractTechStack(files: FileContent[]): string[] {
    const techStack = new Set<string>();

    for (const file of files) {
      if (file.name === "package.json") {
        techStack.add("Node.js");
      } else if (file.name === "requirements.txt") {
        techStack.add("Python");
      } else if (file.name === "Dockerfile") {
        techStack.add("Docker");
      }
    }

    return Array.from(techStack);
  }

  private async storeRepoData(
    owner: string,
    repo: string,
    summary: string,
    webhookUrl?: string
  ) {
    const data = {
      owner,
      repo,
      summary,
      lastAnalyzed: new Date().toISOString(),
      webhookUrl,
    };

    await this.dynamodb.send(
      new PutItemCommand({
        TableName: "github-repos",
        Item: marshall(data),
      })
    );
  }

  private async getProject(projectId: string): Promise<Project | null> {
    const response = await this.dynamodb.send(
      new GetItemCommand({
        TableName: "projects",
        Key: marshall({ projectId }),
      })
    );

    return response.Item ? (unmarshall(response.Item) as Project) : null;
  }

  private parseRepoUrl(url: string): { owner: string; repo: string } {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error("Invalid GitHub repository URL");
    return { owner: match[1], repo: match[2] };
  }
}
