import { Octokit } from "@octokit/rest";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

interface Developer {
  name: string;
  github_username: string;
}

interface RepoData {
  owner: string;
  repo: string;
  lastAnalyzed: string;
  developers: Developer[];
  name?: string;
  summary?: string;
  technicalSummary?: string;
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
    private bedrock: BedrockRuntimeClient,
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
    const developers = await this.fetchContributors(owner, repo);

    const { name, summary, technicalSummary } = await this.generateSummary(
      repoInfo,
      commits,
      files,
      developers
    );

    return {
      owner,
      repo,
      lastAnalyzed: new Date().toISOString(),
      developers,
      name,
      summary,
      technicalSummary,
    };
  }

  private async fetchContributors(
    owner: string,
    repo: string
  ): Promise<Developer[]> {
    const response = await this.octokit.repos.listContributors({
      owner,
      repo,
      per_page: 100,
    });

    return response.data.map((contributor) => ({
      name: contributor.name || contributor.login || "Unknown",
      github_username: contributor.login || "Unknown",
    }));
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
  private async generateSummary(
    repoInfo: any,
    commits: any[],
    files: FileContent[],
    developers: Developer[]
  ): Promise<{ name: string; summary: string; technicalSummary: string }> {
    const techStack = this.extractTechStack(files);
    const lastCommit = commits[0];
    const recentCommits = commits
      .slice(0, 5)
      .map((c) => c.commit.message)
      .join("\n");

    const prompt = `Analyze this GitHub repository and provide a name, summary and technical summary:
  
  Repository Details:
  - Name: ${repoInfo.name}
  - Description: ${repoInfo.description || "No description"}
  - Language: ${repoInfo.language || "Not specified"}
  - Stars: ${repoInfo.stargazers_count}
  - Forks: ${repoInfo.forks_count}
  - Size: ${repoInfo.size} KB
  - Open Issues: ${repoInfo.open_issues_count}
  - Contributors: ${developers.length}
  - Created: ${new Date(repoInfo.created_at).toLocaleDateString()}
  - Last Updated: ${new Date(repoInfo.updated_at).toLocaleDateString()}
  - Tech Stack: ${techStack.join(", ")}
  
  Recent Commits:
  ${recentCommits}
  
  Files Found: ${files.map((f) => f.name).join(", ")}
  
  Please provide:
  1. NAME: A clear, descriptive project name (improve on the repo name if needed)
  2. SUMMARY: A brief, user-friendly overview of what this repository is about, its purpose, and key highlights
  3. TECHNICAL_SUMMARY: A detailed technical analysis including architecture, technologies used, development activity, and technical metrics
  
  Format your response as:
  NAME:
  [name here]
  
  SUMMARY:
  [summary here]
  
  TECHNICAL_SUMMARY:
  [technical summary here]`;

    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
      contentType: "application/json",
    });

    try {
      const response = await this.bedrock.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const content = responseBody.content[0].text;

      const nameMatch = content.match(/NAME:\s*([\s\S]*?)(?=SUMMARY:|$)/);
      const summaryMatch = content.match(
        /SUMMARY:\s*([\s\S]*?)(?=TECHNICAL_SUMMARY:|$)/
      );
      const technicalMatch = content.match(/TECHNICAL_SUMMARY:\s*([\s\S]*?)$/);

      return {
        name: nameMatch?.[1]?.trim() || repoInfo.name,
        summary: summaryMatch?.[1]?.trim() || "Summary generation failed",
        technicalSummary:
          technicalMatch?.[1]?.trim() || "Technical summary generation failed",
      };
    } catch (error) {
      console.error("Bedrock generation failed:", error);
      return this.getFallbackSummary(repoInfo, commits, files, developers);
    }
  }

  private getFallbackSummary(
    repoInfo: any,
    commits: any[],
    files: FileContent[],
    developers: Developer[]
  ): { name: string; summary: string; technicalSummary: string } {
    const techStack = this.extractTechStack(files);

    return {
      name: repoInfo.name,
      summary: `${repoInfo.name}: ${
        repoInfo.description || "A GitHub repository"
      } with ${repoInfo.stargazers_count} stars and ${
        developers.length
      } contributors.`,
      technicalSummary: `Tech stack: ${techStack.join(", ")}. Language: ${
        repoInfo.language
      }. Size: ${repoInfo.size}KB. ${repoInfo.open_issues_count} open issues.`,
    };
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
