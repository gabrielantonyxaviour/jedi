import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";

export interface SocialContent {
  contentId: string;
  projectId: string;
  platform: "twitter" | "linkedin" | "telegram";
  content: string;
  media?: string[];
  status: "draft" | "scheduled" | "posted" | "failed";
  scheduledFor?: string;
  postedAt?: string;
  engagement?: {
    likes: number;
    shares: number;
    comments: number;
  };
  metadata?: Record<string, any>;
}

export class ContentService {
  constructor(
    private dynamodb: DynamoDBClient,
    private s3: S3Client,
    private bedrock: BedrockRuntimeClient,
    private sqs: SQSClient,
    private contentTableName: string,
    private projectsTableName: string,
    private bucketName: string,
    private orchestratorQueue: string
  ) {}

  async postContent(payload: {
    projectId: string;
    platform: "twitter" | "linkedin" | "telegram";
    content: string;
    media?: string[];
    scheduledFor?: string;
  }): Promise<SocialContent> {
    console.log(
      `📝 Posting content for project: ${payload.projectId} on ${payload.platform}`
    );

    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const content: SocialContent = {
      contentId: randomUUID(),
      projectId: payload.projectId,
      platform: payload.platform,
      content: payload.content,
      media: payload.media,
      status: payload.scheduledFor ? "scheduled" : "draft",
      scheduledFor: payload.scheduledFor,
      metadata: {
        characterName: project.characterName,
        characterSide: project.side,
      },
    };

    await this.storeContent(content);

    if (!payload.scheduledFor) {
      await this.publishContent(content);
    }

    return content;
  }

  async getLatestContent(payload: {
    projectId: string;
    platform: "twitter" | "linkedin" | "telegram";
    limit?: number;
  }): Promise<SocialContent[]> {
    console.log(
      `📋 Getting latest content for project: ${payload.projectId} on ${payload.platform}`
    );

    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.contentTableName,
        IndexName: "projectId-platform-postedAt-index",
        KeyConditionExpression:
          "projectId = :projectId AND #platform = :platform",
        ExpressionAttributeNames: {
          "#platform": "platform",
        },
        ExpressionAttributeValues: marshall({
          ":projectId": payload.projectId,
          ":platform": payload.platform,
        }),
        ScanIndexForward: false, // Sort by postedAt descending
        Limit: payload.limit || 20,
      })
    );

    return (response.Items || []).map(
      (item) => unmarshall(item) as SocialContent
    );
  }

  async generateContent(payload: {
    projectId: string;
    platform: "twitter" | "linkedin" | "telegram";
    topic: string;
    tone?: string;
    length?: "short" | "medium" | "long";
  }): Promise<string> {
    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const prompt = `
Generate ${payload.platform} content for this project:

Project:
- Name: ${project.name}
- Description: ${project.description}
- Character: ${project.characterName}
- Side: ${project.side}

Topic: ${payload.topic}
Tone: ${payload.tone || "professional"}
Length: ${payload.length || "medium"}

Consider:
1. Platform-specific best practices
2. Character's personality and side
3. Project's goals and values
4. Engagement potential
5. Call to action

Generate content that is:
- Authentic to the character
- Relevant to the project
- Engaging for the audience
- Appropriate for the platform
`;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          prompt,
          max_tokens: 1000,
          temperature: 0.7,
        }),
      })
    );

    return new TextDecoder().decode(response.body);
  }

  private async publishContent(content: SocialContent): Promise<void> {
    // Implementation for platform-specific publishing
    // This would integrate with actual social media APIs
    content.status = "posted";
    content.postedAt = new Date().toISOString();
    await this.updateContent(content);

    // Notify orchestrator
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.orchestratorQueue,
        MessageBody: JSON.stringify({
          type: "CONTENT_POSTED",
          payload: {
            projectId: content.projectId,
            platform: content.platform,
            contentId: content.contentId,
            postedAt: content.postedAt,
          },
        }),
      })
    );
  }

  private async getProject(projectId: string): Promise<any> {
    const response = await this.dynamodb.send(
      new GetItemCommand({
        TableName: this.projectsTableName,
        Key: marshall({ projectId }),
      })
    );

    return response.Item ? unmarshall(response.Item) : null;
  }

  private async storeContent(content: SocialContent): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.contentTableName,
        Item: marshall(content),
      })
    );
  }

  private async updateContent(content: SocialContent): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.contentTableName,
        Item: marshall(content),
      })
    );
  }
}
