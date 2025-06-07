// src/managers/project-data-manager.ts
import * as fs from "fs/promises";
import * as path from "path";

export class ProjectDataManager {
  private localStoragePath: string;

  constructor() {
    this.localStoragePath = path.join(process.cwd(), "local-storage");
  }

  async getProjectData(owner: string, repo: string) {
    const projectPath = path.join(this.localStoragePath, owner, repo);

    try {
      const analysisPath = path.join(projectPath, "complete-analysis.json");
      const changesPath = path.join(projectPath, "change-history.json");

      const [analysis, changes] = await Promise.all([
        this.readJsonFile(analysisPath),
        this.readJsonFile(changesPath).catch(() => ({ changes: [] })),
      ]);

      return {
        analysis,
        changeHistory: changes,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to get project data for ${owner}/${repo}:`, error);
      return null;
    }
  }

  async updateProjectWithCommit(owner: string, repo: string, commit: any) {
    const projectPath = path.join(this.localStoragePath, owner, repo);

    try {
      // Ensure directory exists
      await fs.mkdir(projectPath, { recursive: true });

      // Update change history
      const changesPath = path.join(projectPath, "change-history.json");
      let changeHistory = await this.readJsonFile(changesPath).catch(() => ({
        changes: [],
      }));

      const newChange = {
        timestamp: new Date().toISOString(),
        commit,
        significance: this.calculateDetailedSignificance(commit),
      };

      changeHistory.changes.unshift(newChange); // Add to beginning
      changeHistory.changes = changeHistory.changes.slice(0, 50); // Keep last 50 changes

      await this.writeJsonFile(changesPath, changeHistory);

      // Update project metadata
      await this.updateProjectMetadata(owner, repo, commit);

      console.log(
        `✅ Updated project data for ${owner}/${repo} with commit ${commit.sha.slice(
          0,
          7
        )}`
      );
    } catch (error) {
      console.error(`Failed to update project with commit:`, error);
    }
  }

  private async updateProjectMetadata(
    owner: string,
    repo: string,
    commit: any
  ) {
    const projectPath = path.join(this.localStoragePath, owner, repo);
    const analysisPath = path.join(projectPath, "complete-analysis.json");

    try {
      const analysis = await this.readJsonFile(analysisPath);

      // Update metadata
      analysis.activity.lastCommit = commit.date;
      analysis.activity.totalCommits += 1;
      analysis.metadata.lastUpdated = new Date().toISOString();

      // Add to recent changes
      if (!analysis.activity.recentChanges) {
        analysis.activity.recentChanges = [];
      }

      const changeAnalysis = {
        type: this.classifyCommitType(commit),
        impact: this.classifyCommitImpact(commit),
        files: commit.files?.map((f: any) => f.filename) || [],
        summary: `${commit.message.split("\n")[0]} | ${
          commit.files?.length || 0
        } files | +${commit.stats?.additions || 0} -${
          commit.stats?.deletions || 0
        }`,
      };

      analysis.activity.recentChanges.unshift(changeAnalysis);
      analysis.activity.recentChanges = analysis.activity.recentChanges.slice(
        0,
        10
      );

      await this.writeJsonFile(analysisPath, analysis);
    } catch (error) {
      console.error("Failed to update project metadata:", error);
    }
  }

  private calculateDetailedSignificance(commit: any): number {
    const filesChanged = commit.files?.length || 0;
    const linesChanged =
      (commit.stats?.additions || 0) + (commit.stats?.deletions || 0);
    const newFiles =
      commit.files?.filter((f: any) => f.status === "added").length || 0;

    return filesChanged * 0.3 + linesChanged * 0.0001 + newFiles * 0.5;
  }

  private classifyCommitType(commit: any): string {
    const message = commit.message.toLowerCase();

    if (message.includes("fix") || message.includes("bug")) return "bugfix";
    if (message.includes("feat") || message.includes("add")) return "feature";
    if (message.includes("refactor")) return "refactor";
    if (message.includes("test")) return "test";
    if (message.includes("doc")) return "docs";
    if (message.includes("config")) return "config";

    return "feature";
  }

  private classifyCommitImpact(commit: any): string {
    const totalChanges =
      (commit.stats?.additions || 0) + (commit.stats?.deletions || 0);

    if (totalChanges > 500) return "major";
    if (totalChanges > 100) return "minor";
    return "patch";
  }

  private async readJsonFile(filePath: string) {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  }

  private async writeJsonFile(filePath: string, data: any) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }
}
