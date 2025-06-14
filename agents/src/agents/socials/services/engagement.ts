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
import { SocialAccount } from "./account";

export interface Engagement {
  engagementId: string;
  projectId: string;
  platform: "twitter" | "linkedin" | "telegram";
  type: "like" | "comment" | "share" | "follow";
  targetId: string;
  targetType: "post" | "user";
  content?: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  metadata?: Record<string, any>;
}

export class EngagementService {
  constructor(
    private dynamodb: DynamoDBClient,
    private s3: S3Client,
    private bedrock: BedrockRuntimeClient,
    private sqs: SQSClient,
    private engagementTableName: string,
    private accountsTableName: string,
    private projectsTableName: string,
    private bucketName: string,
    private orchestratorQueue: string
  ) {}

  async fetchAndEngage(payload: {
    projectId: string;
    platform: "twitter" | "linkedin" | "telegram";
  }): Promise<Engagement[]> {
    console.log(
      `🤝 Fetching and engaging for project: ${payload.projectId} on ${payload.platform}`
    );

    const account = await this.getAccount(payload.projectId, payload.platform);
    if (!account) {
      throw new Error(
        `Account not found for project: ${payload.projectId} on ${payload.platform}`
      );
    }

    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const targets = await this.findEngagementTargets(account, project);
    const engagements = await this.createEngagements(targets, account);

    // Store engagements in DynamoDB
    await Promise.all(
      engagements.map((engagement) => this.storeEngagement(engagement))
    );

    // Store engagement results in S3
    const engagementId = randomUUID();
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `engagements/${engagementId}.json`,
        Body: JSON.stringify({
          projectId: payload.projectId,
          platform: payload.platform,
          engagements,
          timestamp: new Date().toISOString(),
        }),
        ContentType: "application/json",
      })
    );

    // Notify orchestrator
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.orchestratorQueue,
        MessageBody: JSON.stringify({
          type: "ENGAGEMENT_COMPLETE",
          payload: {
            projectId: payload.projectId,
            platform: payload.platform,
            engagementId,
            engagementCount: engagements.length,
          },
        }),
      })
    );

    return engagements;
  }

  private async findEngagementTargets(
    account: SocialAccount,
    project: any
  ): Promise<any[]> {
    const prompt = `
Find engagement targets for this social account:

Account:
- Platform: ${account.platform}
- Username: ${account.username}
- Display Name: ${account.displayName}
- Bio: ${account.bio || "N/A"}
- Personality: ${account.settings.personality}
- Tone: ${account.settings.tone}

Project:
- Name: ${project.name}
- Description: ${project.description}
- Industry: ${project.industry || "Any"}

Consider:
1. Platform-specific engagement opportunities
2. Account's personality and tone
3. Project's goals and values
4. Target relevance and quality
5. Engagement potential

Return a list of targets with:
- Target ID
- Target Type (post/user)
- Engagement Type (like/comment/share/follow)
- Reason for engagement
- Suggested content (for comments)

Format as JSON array.
`;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          prompt,
          max_tokens: 2000,
          temperature: 0.7,
        }),
      })
    );

    return JSON.parse(new TextDecoder().decode(response.body));
  }

  private async createEngagements(
    targets: any[],
    account: SocialAccount
  ): Promise<Engagement[]> {
    return targets.map((target) => ({
      engagementId: randomUUID(),
      projectId: account.projectId,
      platform: account.platform,
      type: target.engagementType,
      targetId: target.targetId,
      targetType: target.targetType,
      content: target.suggestedContent,
      status: "pending",
      createdAt: new Date().toISOString(),
      metadata: {
        reason: target.reason,
        accountId: account.accountId,
        characterName: account.displayName,
        characterSide: account.metadata?.characterSide,
      },
    }));
  }

  private async getAccount(
    projectId: string,
    platform: "twitter" | "linkedin" | "telegram"
  ): Promise<SocialAccount | null> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.accountsTableName,
        IndexName: "projectId-platform-index",
        KeyConditionExpression:
          "projectId = :projectId AND #platform = :platform",
        ExpressionAttributeNames: {
          "#platform": "platform",
        },
        ExpressionAttributeValues: marshall({
          ":projectId": projectId,
          ":platform": platform,
        }),
      })
    );

    return response.Items?.[0]
      ? (unmarshall(response.Items[0]) as SocialAccount)
      : null;
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

  private async storeEngagement(engagement: Engagement): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.engagementTableName,
        Item: marshall(engagement),
      })
    );
  }
}
