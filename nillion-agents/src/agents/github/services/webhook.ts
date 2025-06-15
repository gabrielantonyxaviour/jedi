import { Octokit } from "@octokit/rest";
import { pushLogs } from "../../../services/nillion";
import { v4 as uuidv4 } from "uuid";

export class WebhookService {
  constructor(private octokit: Octokit) {}

  async handleWebhook(
    webhookData: any,
    ownerAddress: string,
    taskId?: string,
    workflowId?: string
  ): Promise<void> {
    const { action, repository, commits, pull_request, release } = webhookData;

    if (!repository) {
      throw new Error("Invalid webhook data: repository information missing");
    }

    const { owner, repo } = this.parseRepoUrl(repository.html_url);

    // Handle different webhook events
    if (commits) {
      await this.processNewCommits(owner, repo, commits, ownerAddress);
    } else if (pull_request) {
      await this.processPullRequest(
        owner,
        repo,
        pull_request,
        action,
        ownerAddress
      );
    } else if (release) {
      await this.processRelease(owner, repo, release, action, ownerAddress);
    }

    // Log the webhook event
    await this.logWebhookEvent(webhookData, ownerAddress, taskId, workflowId);
  }

  private async processNewCommits(
    owner: string,
    repo: string,
    commits: any[],
    ownerAddress: string
  ) {
    await pushLogs({
      id: uuidv4(),
      owner_address: ownerAddress,
      project_id: `${owner}/${repo}`,
      agent_name: "github-webhook-service",
      text: `${commits.length} new commits pushed to ${owner}/${repo}`,
      data: JSON.stringify({
        type: "NEW_COMMITS",
        repository: `${owner}/${repo}`,
        commitCount: commits.length,
        commits: commits.map((commit) => ({
          id: commit.id,
          message: commit.message,
          author: commit.author.name,
          timestamp: commit.timestamp,
        })),
        timestamp: new Date().toISOString(),
      }),
    });
  }

  private async processPullRequest(
    owner: string,
    repo: string,
    pullRequest: any,
    action: string,
    ownerAddress: string
  ) {
    await pushLogs({
      id: uuidv4(),
      owner_address: ownerAddress,
      project_id: `${owner}/${repo}`,
      agent_name: "github-webhook-service",
      text: `Pull request ${action}: #${pullRequest.number} - ${pullRequest.title}`,
      data: JSON.stringify({
        type: "PULL_REQUEST",
        repository: `${owner}/${repo}`,
        action,
        pullRequest: {
          number: pullRequest.number,
          title: pullRequest.title,
          state: pullRequest.state,
          author: pullRequest.user.login,
          createdAt: pullRequest.created_at,
          updatedAt: pullRequest.updated_at,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  }

  private async processRelease(
    owner: string,
    repo: string,
    release: any,
    action: string,
    ownerAddress: string
  ) {
    await pushLogs({
      id: uuidv4(),
      owner_address: ownerAddress,
      project_id: `${owner}/${repo}`,
      agent_name: "github-webhook-service",
      text: `Release ${action}: ${release.tag_name} - ${release.name}`,
      data: JSON.stringify({
        type: "RELEASE",
        repository: `${owner}/${repo}`,
        action,
        release: {
          id: release.id,
          tagName: release.tag_name,
          name: release.name,
          author: release.author.login,
          createdAt: release.created_at,
          publishedAt: release.published_at,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  }

  private async logWebhookEvent(
    webhookData: any,
    ownerAddress: string,
    taskId?: string,
    workflowId?: string
  ) {
    await pushLogs({
      id: uuidv4(),
      owner_address: ownerAddress,
      project_id: workflowId || "webhook",
      agent_name: "github-webhook-service",
      text: `GitHub webhook received: ${webhookData.action || "event"}`,
      data: JSON.stringify({
        type: "GITHUB_WEBHOOK",
        payload: webhookData,
        taskId,
        workflowId,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  private parseRepoUrl(url: string): { owner: string; repo: string } {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error("Invalid GitHub repository URL");
    return { owner: match[1], repo: match[2] };
  }
}
