import { Octokit } from "@octokit/rest";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { marshall } from "@aws-sdk/util-dynamodb";

export class WebhookService {
  constructor(
    private octokit: Octokit,
    private dynamodb: DynamoDBClient,
    private sqsClient: SQSClient
  ) {}

  async handleWebhook(
    webhookData: any,
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
      await this.processNewCommits(owner, repo, commits);
    } else if (pull_request) {
      await this.processPullRequest(owner, repo, pull_request, action);
    } else if (release) {
      await this.processRelease(owner, repo, release, action);
    }

    // Notify orchestrator about the webhook event
    await this.notifyOrchestrator(webhookData, taskId, workflowId);
  }

  private async processNewCommits(owner: string, repo: string, commits: any[]) {
    const commitCount = commits.length;
    await this.updateLastActivity(owner, repo, "commits", commitCount);

    // Store detailed commit information
    for (const commit of commits) {
      await this.storeCommitDetails(owner, repo, commit);
    }
  }

  private async processPullRequest(
    owner: string,
    repo: string,
    pullRequest: any,
    action: string
  ) {
    await this.updateLastActivity(owner, repo, "pull_requests", 1);

    const prData = {
      owner,
      repo,
      prNumber: pullRequest.number,
      action,
      title: pullRequest.title,
      state: pullRequest.state,
      createdAt: pullRequest.created_at,
      updatedAt: pullRequest.updated_at,
      author: pullRequest.user.login,
    };

    await this.storePullRequestDetails(prData);
  }

  private async processRelease(
    owner: string,
    repo: string,
    release: any,
    action: string
  ) {
    await this.updateLastActivity(owner, repo, "releases", 1);

    const releaseData = {
      owner,
      repo,
      releaseId: release.id,
      action,
      tagName: release.tag_name,
      name: release.name,
      createdAt: release.created_at,
      publishedAt: release.published_at,
      author: release.author.login,
    };

    await this.storeReleaseDetails(releaseData);
  }

  private async updateLastActivity(
    owner: string,
    repo: string,
    type: string,
    count: number
  ) {
    const updateExpression = "SET lastActivity = :now, #type = :count";
    const expressionAttributeNames = {
      "#type": type,
    };
    const expressionAttributeValues = {
      ":now": new Date().toISOString(),
      ":count": count,
    };

    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: "github-repos",
        Key: marshall({ owner, repo }),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
      })
    );
  }

  private async storeCommitDetails(owner: string, repo: string, commit: any) {
    const commitData = {
      owner,
      repo,
      sha: commit.id,
      message: commit.message,
      author: commit.author.name,
      timestamp: commit.timestamp,
    };

    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: "github-commits",
        Key: marshall({ owner, repo, sha: commit.id }),
        UpdateExpression: "SET commitData = :data",
        ExpressionAttributeValues: marshall({
          ":data": commitData,
        }),
      })
    );
  }

  private async storePullRequestDetails(prData: any) {
    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: "github-pull-requests",
        Key: marshall({
          owner: prData.owner,
          repo: prData.repo,
          prNumber: prData.prNumber,
        }),
        UpdateExpression: "SET prData = :data",
        ExpressionAttributeValues: {
          ":data": marshall(prData),
        },
      })
    );
  }

  private async storeReleaseDetails(releaseData: any) {
    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: "github-releases",
        Key: marshall({
          owner: releaseData.owner,
          repo: releaseData.repo,
          releaseId: releaseData.releaseId,
        }),
        UpdateExpression: "SET releaseData = :data",
        ExpressionAttributeValues: {
          ":data": marshall(releaseData),
        },
      })
    );
  }

  private async notifyOrchestrator(
    webhookData: any,
    taskId?: string,
    workflowId?: string
  ) {
    const message = {
      type: "GITHUB_WEBHOOK",
      payload: webhookData,
      taskId,
      workflowId,
      timestamp: new Date().toISOString(),
    };

    await this.sqsClient.send(
      new SendMessageCommand({
        QueueUrl: process.env.ORCHESTRATOR_QUEUE_URL,
        MessageBody: JSON.stringify(message),
      })
    );
  }

  private parseRepoUrl(url: string): { owner: string; repo: string } {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error("Invalid GitHub repository URL");
    return { owner: match[1], repo: match[2] };
  }
}
