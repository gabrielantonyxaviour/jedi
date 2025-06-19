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
import { wrapMetaLlamaPrompt } from "@/utils/helper";

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

  async analyzeRepository(repoUrl: string): Promise<RepoData> {
    console.log(`🔍 Starting repository analysis for: ${repoUrl}`);

    const { owner, repo } = this.parseRepoUrl(repoUrl);
    console.log(`📋 Parsed repo URL - Owner: ${owner}, Repo: ${repo}`);

    console.log(`📊 Fetching repository info...`);
    const repoInfo = await this.fetchRepositoryInfo(owner, repo);
    console.log(`✅ Repository info fetched:`, {
      name: repoInfo.name,
      description: repoInfo.description,
      language: repoInfo.language,
      stars: repoInfo.stargazers_count,
      forks: repoInfo.forks_count,
      openIssues: repoInfo.open_issues_count,
    });

    console.log(`📝 Fetching recent commits...`);
    const commits = await this.fetchRecentCommits(owner, repo);
    console.log(`✅ Fetched ${commits.length} recent commits`);

    console.log(`📁 Fetching important files...`);
    const files = await this.fetchImportantFiles(owner, repo);
    console.log(
      `✅ Fetched ${files.length} important files:`,
      files.map((f) => f.name)
    );

    console.log(`👥 Fetching contributors...`);
    const developers = await this.fetchContributors(owner, repo);
    console.log(
      `✅ Fetched ${developers.length} contributors:`,
      developers.map((d) => d.github_username)
    );

    console.log(`🤖 Generating AI summary...`);
    const { name, summary, technicalSummary } = await this.generateSummary(
      repoInfo,
      commits,
      files,
      developers
    );
    console.log(`✅ AI summary generated:`, {
      name,
      summary: summary?.substring(0, 100) + "...",
    });

    const payload = {
      owner,
      repo,
      lastAnalyzed: new Date().toISOString(),
      developers,
      name,
      summary,
      technicalSummary,
    };

    console.log(`🎉 Repository analysis completed successfully`);
    return payload;
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
    const payloads = [];

    for (const file of payload.files) {
      const payload = await this.updateFile(
        owner,
        repo,
        file.path,
        file.content,
        file.message
      );
      payloads.push(payload);
    }

    return payloads;
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

    const prompt = `Analyze the following GitHub repository and generate:

      1. **NAME** – A clear, improved name for the project
      2. **SUMMARY** – A short, user-friendly overview of the repo, its purpose, and main features
      3. **TECHNICAL_SUMMARY** – A deeper technical explanation covering tech stack, architecture, activity, and metrics
      
      Repository Info:
      - Name: ${repoInfo.name}
      - Description: ${repoInfo.description || "No description"}
      - Language: ${repoInfo.language || "Not specified"}
      - Tech Stack: ${techStack.join(", ")}

      Files:
      ${files.map((f) => f.name).join(", ")}

      Please format your output as:
      NAME:
      [Your answer]
      
      SUMMARY:
      [Your answer]
      
      TECHNICAL_SUMMARY:
      [Your answer]`;

    const command = new InvokeModelCommand({
      modelId: "meta.llama3-70b-instruct-v1:0",
      body: JSON.stringify({
        prompt: wrapMetaLlamaPrompt(prompt),
        max_gen_len: 512,
        temperature: 0.5,
        top_p: 0.9,
      }),
      contentType: "application/json",
    });

    try {
      const response = await this.bedrock.send(command);
      const { generation: content } = JSON.parse(
        new TextDecoder().decode(response.body)
      );
      console.log("Raw AI response:", content);

      // More flexible parsing - split by sections and handle various formats
      const sections = content.split(
        /\n\s*(?:NAME|SUMMARY|TECHNICAL_SUMMARY):\s*\n/i
      );

      let name = repoInfo.name;
      let summary = "Summary generation failed";
      let technicalSummary = "Technical summary generation failed";

      if (sections.length >= 2) {
        // Try to extract name from first section or look for it in content
        const nameMatch = content.match(/NAME:\s*([^\n]+)/i);
        if (nameMatch) {
          name = nameMatch[1].trim();
        }

        // Try to extract summary
        const summaryMatch = content.match(
          /SUMMARY:\s*([\s\S]*?)(?=\n\s*(?:TECHNICAL_SUMMARY|$))/i
        );
        if (summaryMatch) {
          summary = summaryMatch[1].trim();
        } else if (sections.length >= 3) {
          summary = sections[2].trim();
        }

        // Try to extract technical summary
        const technicalMatch = content.match(
          /TECHNICAL_SUMMARY:\s*([\s\S]*?)$/i
        );
        if (technicalMatch) {
          technicalSummary = technicalMatch[1].trim();
        } else if (sections.length >= 4) {
          technicalSummary = sections[3].trim();
        }
      }

      // Fallback: if we still have failures, try to extract any meaningful content
      if (summary === "Summary generation failed" && content.length > 50) {
        const lines = content
          .split("\n")
          .filter((line: string) => line.trim().length > 10);
        if (lines.length > 0) {
          summary = lines.slice(0, 2).join(" ").substring(0, 200);
        }
      }

      if (
        technicalSummary === "Technical summary generation failed" &&
        content.length > 100
      ) {
        const lines = content
          .split("\n")
          .filter((line: string) => line.trim().length > 20);
        if (lines.length > 2) {
          technicalSummary = lines.slice(-3).join(" ").substring(0, 300);
        }
      }

      return {
        name,
        summary,
        technicalSummary,
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
