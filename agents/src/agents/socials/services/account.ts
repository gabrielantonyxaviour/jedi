import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";

export interface SocialAccount {
  accountId: string;
  projectId: string;
  platform: "twitter" | "linkedin" | "telegram";
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  status: "active" | "inactive" | "pending";
  credentials?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
  };
  settings: {
    frequency: string;
    tone: string;
    personality: string;
    autoEngage: boolean;
    autoRespond: boolean;
  };
  stats?: {
    followers: number;
    following: number;
    posts: number;
    engagement: number;
  };
  metadata?: Record<string, any>;
}

export class AccountService {
  constructor(
    private dynamodb: DynamoDBClient,
    private s3: S3Client,
    private bedrock: BedrockRuntimeClient,
    private sqs: SQSClient,
    private accountsTableName: string,
    private projectsTableName: string,
    private bucketName: string,
    private orchestratorQueue: string
  ) {}

  async setupSocial(payload: {
    projectId: string;
    platform: "twitter" | "linkedin" | "telegram";
    characterName: string;
    characterSide: "light" | "dark";
  }): Promise<SocialAccount> {
    console.log(
      `🔧 Setting up social account for project: ${payload.projectId} on ${payload.platform}`
    );

    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const account: SocialAccount = {
      accountId: randomUUID(),
      projectId: payload.projectId,
      platform: payload.platform,
      username: await this.generateUsername(payload),
      displayName: payload.characterName,
      bio: await this.generateBio(payload, project),
      status: "pending",
      settings: {
        frequency: "daily",
        tone: payload.characterSide === "light" ? "friendly" : "assertive",
        personality:
          payload.characterSide === "light" ? "helpful" : "ambitious",
        autoEngage: true,
        autoRespond: true,
      },
      metadata: {
        characterName: payload.characterName,
        characterSide: payload.characterSide,
      },
    };

    await this.storeAccount(account);

    // Notify orchestrator
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.orchestratorQueue,
        MessageBody: JSON.stringify({
          type: "SOCIAL_ACCOUNT_SETUP",
          payload: {
            projectId: payload.projectId,
            platform: payload.platform,
            accountId: account.accountId,
          },
        }),
      })
    );

    return account;
  }

  async modifyCharacter(payload: {
    projectId: string;
    platform: "twitter" | "linkedin" | "telegram";
    personality: string;
    tone: string;
  }): Promise<SocialAccount> {
    console.log(
      `🎭 Modifying character for project: ${payload.projectId} on ${payload.platform}`
    );

    const account = await this.getAccount(payload.projectId, payload.platform);
    if (!account) {
      throw new Error(
        `Account not found for project: ${payload.projectId} on ${payload.platform}`
      );
    }

    account.settings.personality = payload.personality;
    account.settings.tone = payload.tone;
    account.bio = await this.generateBio(
      {
        projectId: payload.projectId,
        platform: payload.platform,
        characterName: account.displayName,
        characterSide: account.metadata?.characterSide || "light",
      },
      await this.getProject(payload.projectId)
    );

    await this.updateAccount(account);

    return account;
  }

  async setFrequency(payload: {
    projectId: string;
    platform: "twitter" | "linkedin" | "telegram";
    frequency: string;
  }): Promise<SocialAccount> {
    console.log(
      `⏰ Setting frequency for project: ${payload.projectId} on ${payload.platform}`
    );

    const account = await this.getAccount(payload.projectId, payload.platform);
    if (!account) {
      throw new Error(
        `Account not found for project: ${payload.projectId} on ${payload.platform}`
      );
    }

    account.settings.frequency = payload.frequency;
    await this.updateAccount(account);

    return account;
  }

  async getAccount(
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

  private async generateUsername(payload: {
    projectId: string;
    platform: "twitter" | "linkedin" | "telegram";
    characterName: string;
    characterSide: "light" | "dark";
  }): Promise<string> {
    const prompt = `
Generate a ${payload.platform} username for this character:

Character:
- Name: ${payload.characterName}
- Side: ${payload.characterSide}

Consider:
1. Platform-specific username conventions
2. Character's personality and side
3. Professional vs casual tone
4. Length restrictions
5. Availability likelihood

Return only the username.
`;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          prompt,
          max_tokens: 100,
          temperature: 0.7,
        }),
      })
    );

    return new TextDecoder().decode(response.body).trim();
  }

  private async generateBio(
    payload: {
      projectId: string;
      platform: "twitter" | "linkedin" | "telegram";
      characterName: string;
      characterSide: "light" | "dark";
    },
    project: any
  ): Promise<string> {
    const prompt = `
Generate a ${payload.platform} bio for this character:

Character:
- Name: ${payload.characterName}
- Side: ${payload.characterSide}

Project:
- Name: ${project.name}
- Description: ${project.description}

Consider:
1. Platform-specific bio conventions
2. Character's personality and side
3. Project's goals and values
4. Professional vs casual tone
5. Length restrictions

Return only the bio text.
`;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          prompt,
          max_tokens: 200,
          temperature: 0.7,
        }),
      })
    );

    return new TextDecoder().decode(response.body).trim();
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

  private async storeAccount(account: SocialAccount): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.accountsTableName,
        Item: marshall(account),
      })
    );
  }

  private async updateAccount(account: SocialAccount): Promise<void> {
    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: this.accountsTableName,
        Key: marshall({ accountId: account.accountId }),
        UpdateExpression: "SET #settings = :settings, #bio = :bio",
        ExpressionAttributeNames: {
          "#settings": "settings",
          "#bio": "bio",
        },
        ExpressionAttributeValues: marshall({
          ":settings": account.settings,
          ":bio": account.bio,
        }),
      })
    );
  }
}
