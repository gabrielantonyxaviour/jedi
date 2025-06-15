import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import { pushGithub, fetchGithub, pushLogs } from "../../../services/nillion";
import { GithubData } from "../../../types/nillion";
import { v4 as uuidv4 } from "uuid";

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

interface FileContent {
  type: string;
  name: string;
  path: string;
  sha: string;
  content?: string;
}

export class RepositoryService {
  constructor(private octokit: Octokit, private openai: OpenAI) {}

  async analyzeRepository(
    projectId: string,
    repoUrl: string,
    ownerAddress: string,
    taskId?: string,
    workflowId?: string
  ): Promise<RepoData> {
    console.log(`[RepositoryService] Starting analysis for ${repoUrl}`);
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    console.log(
      `[RepositoryService] Fetching repository info for ${owner}/${repo}`
    );
    const repoInfo = await this.fetchRepositoryInfo(owner, repo);

    console.log(`[RepositoryService] Fetching recent commits`);
    const commits = await this.fetchRecentCommits(owner, repo);

    console.log(`[RepositoryService] Fetching important files`);
    const files = await this.fetchImportantFiles(owner, repo);

    console.log(`[RepositoryService] Fetching contributors`);
    const developers = await this.fetchContributors(owner, repo);

    console.log(`[RepositoryService] Generating summary`);
    const { name, summary, technicalSummary } = await this.generateSummary(
      repoInfo,
      commits,
      files,
      developers
    );

    const repoData: RepoData = {
      owner,
      repo,
      lastAnalyzed: new Date().toISOString(),
      developers,
      name,
      summary,
      technicalSummary,
    };

    console.log(`[RepositoryService] Storing analysis in Nillion`);
    console.log("Storing Data");
    console.log({
      project_id: projectId,
      name: name || repoInfo.name,
      description: summary.slice(0, 500) || "",
      technical_description: technicalSummary.slice(0, 500) || "",
      repo_url: repoUrl,
      owner: owner,
      collab: developers.map((d) => d.github_username).join(","),
      owner_address: ownerAddress,
      metadata: JSON.stringify({
        repoInfo: {
          name: repoInfo.name,
          full_name: repoInfo.full_name,
          language: repoInfo.language,
          stars: repoInfo.stargazers_count,
          forks: repoInfo.forks_count,
          size: repoInfo.size,
          open_issues: repoInfo.open_issues_count,
        },
        lastAnalyzed: repoData.lastAnalyzed,
        taskId,
        workflowId,
      }),
    });

    await pushGithub({
      project_id: projectId,
      name: name || repoInfo.name,
      description: summary.slice(0, 500) || "",
      technical_description: technicalSummary.slice(0, 500) || "",
      repo_url: repoUrl,
      owner: owner,
      collab: developers.map((d) => d.github_username).join(","),
      owner_address: ownerAddress,
      metadata: JSON.stringify({
        repoInfo: {
          name: repoInfo.name,
          full_name: repoInfo.full_name,
          language: repoInfo.language,
          stars: repoInfo.stargazers_count,
          forks: repoInfo.forks_count,
          size: repoInfo.size,
          open_issues: repoInfo.open_issues_count,
        },
        lastAnalyzed: repoData.lastAnalyzed,
        taskId,
        workflowId,
      }),
    });

    // Log the analysis completion
    console.log(`[RepositoryService] Logging analysis completion`);
    await pushLogs({
      id: uuidv4(),
      owner_address: ownerAddress,
      project_id: workflowId || "analysis",
      agent_name: "github-intelligence",
      text: `Repository analysis completed for ${owner}/${repo}`,
      data: JSON.stringify({
        type: "REPOSITORY_ANALYSIS",
        repoUrl,
        repoInfo: {
          name: repoInfo.name,
          full_name: repoInfo.full_name,
          language: repoInfo.language,
          stars: repoInfo.stargazers_count,
          forks: repoInfo.forks_count,
          size: repoInfo.size,
          open_issues: repoInfo.open_issues_count,
        },
        timestamp: new Date().toISOString(),
      }),
    });

    console.log(`[RepositoryService] Analysis completed successfully`);
    return repoData;
  }

  async getLatestCommits(payload: {
    repoUrl: string;
    ownerAddress: string;
    count?: number;
  }): Promise<any> {
    const { owner, repo } = this.parseRepoUrl(payload.repoUrl);
    const commits = await this.fetchRecentCommits(
      owner,
      repo,
      payload.count || 10
    );

    // Log the commit fetch
    await pushLogs({
      id: uuidv4(),
      owner_address: payload.ownerAddress,
      project_id: "commits",
      agent_name: "github-intelligence",
      text: `Fetched ${commits.length} latest commits from ${owner}/${repo}`,
      data: JSON.stringify({
        type: "FETCH_COMMITS",
        repoUrl: payload.repoUrl,
        commitCount: commits.length,
        commits: commits.slice(0, 5).map((c) => ({
          sha: c.sha,
          message: c.commit.message,
          author: c.commit.author?.name || "Unknown",
          date: c.commit.author?.date || new Date().toISOString(),
        })),
        timestamp: new Date().toISOString(),
      }),
    });

    return commits;
  }

  async fetchRepoInfo(payload: {
    repoUrl: string;
    ownerAddress: string;
  }): Promise<any> {
    const { owner, repo } = this.parseRepoUrl(payload.repoUrl);
    const repoInfo = await this.fetchRepositoryInfo(owner, repo);

    // Log the repo info fetch
    await pushLogs({
      id: uuidv4(),
      owner_address: payload.ownerAddress,
      project_id: "repo-info",
      agent_name: "github-intelligence",
      text: `Fetched repository info for ${owner}/${repo}`,
      data: JSON.stringify({
        type: "FETCH_REPO_INFO",
        repoUrl: payload.repoUrl,
        repoInfo: {
          name: repoInfo.name,
          description: repoInfo.description,
          language: repoInfo.language,
          stars: repoInfo.stargazers_count,
          forks: repoInfo.forks_count,
        },
        timestamp: new Date().toISOString(),
      }),
    });

    return repoInfo;
  }

  async fetchImportantFilesForProject(payload: {
    repoUrl: string;
    ownerAddress: string;
  }): Promise<any> {
    const { owner, repo } = this.parseRepoUrl(payload.repoUrl);
    const files = await this.fetchImportantFiles(owner, repo);

    // Log the file fetch
    await pushLogs({
      id: uuidv4(),
      owner_address: payload.ownerAddress,
      project_id: "files",
      agent_name: "github-intelligence",
      text: `Fetched ${files.length} important files from ${owner}/${repo}`,
      data: JSON.stringify({
        type: "FETCH_IMPORTANT_FILES",
        repoUrl: payload.repoUrl,
        files: files.map((f) => ({ name: f.name, path: f.path, type: f.type })),
        timestamp: new Date().toISOString(),
      }),
    });

    return files;
  }

  async updateImportantFiles(payload: {
    repoUrl: string;
    ownerAddress: string;
    files: Array<{ path: string; content: string; message: string }>;
  }): Promise<any> {
    const { owner, repo } = this.parseRepoUrl(payload.repoUrl);
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

    // Log the file updates
    await pushLogs({
      id: uuidv4(),
      owner_address: payload.ownerAddress,
      project_id: "file-updates",
      agent_name: "github-intelligence",
      text: `Updated ${payload.files.length} files in ${owner}/${repo}`,
      data: JSON.stringify({
        type: "UPDATE_FILES",
        repoUrl: payload.repoUrl,
        updates: payload.files.map((f) => ({
          path: f.path,
          message: f.message,
        })),
        results,
        timestamp: new Date().toISOString(),
      }),
    });

    return results;
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

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

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
      console.error("OpenAI generation failed:", error);
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

  private parseRepoUrl(url: string): { owner: string; repo: string } {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error("Invalid GitHub repository URL");
    return { owner: match[1], repo: match[2] };
  }
}
