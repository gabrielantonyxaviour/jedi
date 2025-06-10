// src/agents/social-media.ts
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

interface SocialContent {
  contentId: string;
  projectId: string;
  platform: "twitter" | "linkedin" | "facebook";
  content: string;
  mediaUrls?: string[];
  scheduledTime: number;
  status: "scheduled" | "posted" | "failed";
  engagement?: {
    likes: number;
    shares: number;
    comments: number;
  };
  postedAt?: string;
  postUrl?: string;
}

export class SocialsAgent {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private bedrock: BedrockRuntimeClient;
  private sqs: SQSClient;
  private secrets: SecretsManagerClient;
  private contentTableName: string;
  private projectsTableName: string;
  private bucketName: string;
  private orchestratorQueue: string;
  private twitterCredentials: any;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.secrets = new SecretsManagerClient({ region: process.env.AWS_REGION });

    this.contentTableName = process.env.SOCIAL_MEDIA_CONTENT_TABLE!;
    this.projectsTableName = process.env.PROJECTS_TABLE_NAME!;
    this.bucketName = process.env.SOCIAL_MEDIA_BUCKET!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
  }

  async processTask(task: any): Promise<void> {
    console.log(`📱 Processing social media task: ${task.type}`);

    try {
      switch (task.type) {
        case "GENERATE_CONTENT":
          const content = await this.generateContent(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            content,
          });
          break;

        case "SCHEDULE_POST":
          const scheduled = await this.schedulePost(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            scheduled,
          });
          break;

        case "POST_CONTENT":
          const posted = await this.postContent(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            posted,
          });
          break;

        case "ANALYZE_ENGAGEMENT":
          const analytics = await this.analyzeEngagement(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            analytics,
          });
          break;
      }
    } catch (error: any) {
      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        null,
        error.message
      );
      throw error;
    }
  }

  async generateContent(payload: {
    projectId: string;
    platform: string;
    contentType: string;
    context?: string;
  }): Promise<SocialContent> {
    const project = await this.getProject(payload.projectId);

    const prompt = `
Generate engaging social media content for a project.

Project: ${project.name}
Description: ${project.description}
Platform: ${payload.platform}
Content Type: ${payload.contentType}
Context: ${payload.context || "General project update"}

Create ${payload.platform} content that is:
- Engaging and platform-appropriate
- Professional but accessible
- Includes relevant hashtags
- Optimized for ${payload.platform} format
- Maximum length appropriate for platform

Return only the content text.
    `;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const contentText = result.content[0].text;

    const socialContent: SocialContent = {
      contentId: randomUUID(),
      projectId: payload.projectId,
      platform: payload.platform as any,
      content: contentText,
      scheduledTime: Date.now() + 1000 * 60 * 60, // 1 hour from now
      status: "scheduled",
    };

    await this.storeContent(socialContent);
    return socialContent;
  }

  async schedulePost(payload: {
    contentId: string;
    scheduledTime: number;
  }): Promise<boolean> {
    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: this.contentTableName,
        Key: marshall({ contentId: payload.contentId }),
        UpdateExpression: "SET scheduledTime = :time, #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":time": payload.scheduledTime,
          ":status": "scheduled",
        }),
      })
    );

    return true;
  }

  async postContent(payload: { contentId: string }): Promise<boolean> {
    const content = await this.getContent(payload.contentId);

    if (!content) {
      throw new Error("Content not found");
    }

    // TODO: Implement actual posting to social media platforms
    // For Twitter: Use Twitter API v2
    // For LinkedIn: Use LinkedIn API
    // For Facebook: Use Facebook Graph API

    console.log(
      `📱 Posting to ${content.platform}: ${content.content.substring(
        0,
        50
      )}...`
    );

    // Simulate posting
    const postUrl = `https://${content.platform}.com/post/${content.contentId}`;

    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: this.contentTableName,
        Key: marshall({ contentId: content.contentId }),
        UpdateExpression:
          "SET #status = :status, postedAt = :postedAt, postUrl = :postUrl",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":status": "posted",
          ":postedAt": new Date().toISOString(),
          ":postUrl": postUrl,
        }),
      })
    );

    return true;
  }

  async analyzeEngagement(payload: {
    projectId: string;
    timeRange?: string;
  }): Promise<any> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.contentTableName,
        IndexName: "projectId-index",
        KeyConditionExpression: "projectId = :projectId",
        FilterExpression: "#status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":projectId": payload.projectId,
          ":status": "posted",
        }),
      })
    );

    const posts = (response.Items || []).map(
      (item) => unmarshall(item) as SocialContent
    );

    // TODO: Fetch actual engagement metrics from social media APIs
    // For now, simulate analytics

    const analytics = {
      totalPosts: posts.length,
      totalEngagement: posts.reduce((sum, post) => {
        const engagement = post.engagement || {
          likes: 0,
          shares: 0,
          comments: 0,
        };
        return sum + engagement.likes + engagement.shares + engagement.comments;
      }, 0),
      platformBreakdown: this.calculatePlatformBreakdown(posts),
      topPerformingPosts: posts
        .sort((a, b) => this.getEngagementScore(b) - this.getEngagementScore(a))
        .slice(0, 5),
      recommendations: await this.generateRecommendations(posts),
    };

    return analytics;
  }

  private async getTwitterCredentials(): Promise<any> {
    if (this.twitterCredentials) return this.twitterCredentials;

    const response = await this.secrets.send(
      new GetSecretValueCommand({
        SecretId: process.env.TWITTER_CREDENTIALS_SECRET!,
      })
    );

    this.twitterCredentials = JSON.parse(response.SecretString!);
    return this.twitterCredentials;
  }

  private async getProject(projectId: string): Promise<any> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.projectsTableName,
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({ ":projectId": projectId }),
      })
    );

    return response.Items ? unmarshall(response.Items[0]) : null;
  }

  private async getContent(contentId: string): Promise<SocialContent | null> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.contentTableName,
        KeyConditionExpression: "contentId = :contentId",
        ExpressionAttributeValues: marshall({ ":contentId": contentId }),
      })
    );

    return response.Items
      ? (unmarshall(response.Items[0]) as SocialContent)
      : null;
  }

  private async storeContent(content: SocialContent): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.contentTableName,
        Item: marshall(content),
      })
    );
  }

  private calculatePlatformBreakdown(posts: SocialContent[]) {
    const breakdown: Record<string, number> = {};
    posts.forEach((post) => {
      breakdown[post.platform] = (breakdown[post.platform] || 0) + 1;
    });
    return breakdown;
  }

  private getEngagementScore(post: SocialContent): number {
    const engagement = post.engagement || { likes: 0, shares: 0, comments: 0 };
    return engagement.likes + engagement.shares * 2 + engagement.comments * 3;
  }

  private async generateRecommendations(
    posts: SocialContent[]
  ): Promise<string[]> {
    const prompt = `
Analyze these social media posts and provide recommendations for improving engagement:

Posts: ${posts
      .map((p) => `${p.platform}: ${p.content.substring(0, 100)}...`)
      .join("\n")}

Provide 3-5 specific, actionable recommendations for improving social media strategy.
    `;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.content[0].text
      .split("\n")
      .filter((line: string) => line.trim());
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string
  ) {
    try {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: this.orchestratorQueue,
          MessageBody: JSON.stringify({
            type: "TASK_COMPLETION",
            payload: {
              taskId,
              workflowId,
              status: error ? "FAILED" : "COMPLETED",
              result,
              error,
              timestamp: new Date().toISOString(),
              agent: "social-media",
            },
          }),
        })
      );
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}
