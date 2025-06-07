// src/handlers/webhook-handler.ts
import { Request, Response } from "express";
import { Octokit } from "@octokit/rest";
import { UniversalGitHubAgent } from "../agents/github";
import { ProjectDataManager } from "../managers/project-data";
import crypto from "crypto";

export class WebhookHandler {
  private octokit: Octokit;
  private githubAgent: UniversalGitHubAgent;
  private dataManager: ProjectDataManager;

  constructor(
    githubAgent: UniversalGitHubAgent,
    dataManager: ProjectDataManager
  ) {
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    this.githubAgent = githubAgent;
    this.dataManager = dataManager;
  }

  async registerWebhook(repoUrl: string): Promise<string> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    try {
      // Check if webhook already exists
      const { data: hooks } = await this.octokit.rest.repos.listWebhooks({
        owner,
        repo,
      });

      const webhookUrl = `${
        process.env.WEBHOOK_BASE_URL || "https://your-domain.com"
      }/webhook/github`;
      const existingHook = hooks.find((hook) => hook.config.url === webhookUrl);

      if (existingHook) {
        console.log(`✅ Webhook already exists for ${owner}/${repo}`);
        return webhookUrl;
      }

      // Create new webhook
      const { data: webhook } = await this.octokit.rest.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: "json",
          secret: process.env.GITHUB_WEBHOOK_SECRET || "your-secret-here",
        },
        events: ["push"],
      });

      console.log(`✅ Webhook registered for ${owner}/${repo}: ${webhook.id}`);
      return webhookUrl;
    } catch (error: any) {
      console.error(
        `❌ Failed to register webhook for ${owner}/${repo}:`,
        error.message
      );
      throw error;
    }
  }

  async handleWebhook(req: Request, res: Response) {
    const signature = req.headers["x-hub-signature-256"] as string;
    const payload = JSON.stringify(req.body);

    // Verify webhook signature (optional but recommended)
    if (process.env.GITHUB_WEBHOOK_SECRET) {
      const expectedSignature = `sha256=${crypto
        .createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET)
        .update(payload)
        .digest("hex")}`;

      if (signature !== expectedSignature) {
        console.log("❌ Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const event = req.headers["x-github-event"] as string;

    if (event === "push") {
      await this.handlePushEvent(req.body);
    }

    res.status(200).json({ received: true });
  }

  private async handlePushEvent(payload: any) {
    const { repository, commits, pusher } = payload;
    const repoName = repository.full_name;

    console.log(`📥 Received push event for ${repoName}`);
    console.log(`   Commits: ${commits.length}`);
    console.log(`   Pusher: ${pusher.name}`);

    try {
      // Process commits
      for (const commit of commits) {
        console.log(
          `🔄 Processing commit: ${commit.id.slice(0, 7)} - ${commit.message}`
        );

        // Check if this is a significant commit
        const significance = this.calculateSignificance(commit);

        if (significance > 0.2) {
          // Only process significant commits
          console.log(
            `   ✅ Significant commit (score: ${significance.toFixed(2)})`
          );

          // Fetch detailed commit data
          const [owner, repo] = repoName.split("/");
          const detailedCommit = await this.fetchCommitDetails(
            owner,
            repo,
            commit.id
          );

          // Update project data
          await this.dataManager.updateProjectWithCommit(
            owner,
            repo,
            detailedCommit
          );
        } else {
          console.log(
            `   ⏭️ Skipping minor commit (score: ${significance.toFixed(2)})`
          );
        }
      }
    } catch (error) {
      console.error(`❌ Error processing push event for ${repoName}:`, error);
    }
  }

  private calculateSignificance(commit: any): number {
    const filesChanged =
      commit.added.length + commit.modified.length + commit.removed.length;
    const newFiles = commit.added.length;

    // Rough significance calculation (will be refined with actual diff data)
    return filesChanged * 0.3 + newFiles * 0.5;
  }

  private async fetchCommitDetails(owner: string, repo: string, sha: string) {
    try {
      const { data } = await this.octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });

      return {
        sha: data.sha,
        message: data.commit.message,
        author: data.commit.author?.name,
        date: data.commit.author?.date,
        stats: data.stats,
        files:
          data.files?.map((f) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
            changes: f.changes,
          })) || [],
      };
    } catch (error) {
      console.error(`Failed to fetch commit details for ${sha}:`, error);
      return null;
    }
  }

  private parseRepoUrl(url: string): { owner: string; repo: string } {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error("Invalid GitHub URL");
    return { owner: match[1], repo: match[2].replace(".git", "") };
  }
}
