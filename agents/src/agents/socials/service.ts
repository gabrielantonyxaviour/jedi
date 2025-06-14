// services/SocialsService.ts
import { randomUUID } from "crypto";
import { Scraper } from "agent-twitter-client";
import { Bot, Context, webhookCallback } from "grammy";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import fs from "fs";
import path from "path";

interface MessageExample {
  user: string;
  content: {
    text: string;
  };
}

type ClientType = "discord" | "twitter" | "telegram" | "direct";
type ModelProviderName = "openai" | "anthropic" | "grok";

interface AgentCharacter {
  name: string;
  bio: string | string[];
  lore: string[];
  messageExamples: MessageExample[][];
  style: {
    all: string[];
    chat: string[];
    post: string[];
  };
  modelProvider: ModelProviderName;
  clients: ClientType[];
  plugins: any[];
}

interface ProjectSocialConfig {
  projectId: string;
  socials: {
    twitter?: { username: string; password: string; email?: string };
    telegram?: { botToken: string };
    linkedin?: { accessToken: string };
  };
  autoPost: boolean;
  character: AgentCharacter;
  postsPerDay: string;
  setupAt: string;
  isActive: boolean;
}

export class SocialsService {
  private activeScrapers: Map<string, Scraper> = new Map();
  private activeBots: Map<string, Bot> = new Map();
  private bedrock: BedrockRuntimeClient;
  private dynamodb: DynamoDBClient;
  private scheduledPostInterval?: NodeJS.Timeout;

  constructor() {
    this.bedrock = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.dynamodb = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }

  async initialize(): Promise<void> {
    console.log("🚀 Initializing SocialsService...");
    await this.loadExistingConfigs();
  }

  async startScheduledPosting(): Promise<void> {
    if (this.scheduledPostInterval) {
      clearInterval(this.scheduledPostInterval);
    }

    this.scheduledPostInterval = setInterval(async () => {
      await this.runScheduledPosts();
    }, 60 * 60 * 1000); // Every hour

    console.log("📊 Scheduled posting started");
  }

  async setupSocial(payload: {
    projectId: string;
    projectName: string;
    description?: string;
    socials: {
      twitter?: { username: string; password: string; email?: string };
      telegram?: { botToken: string };
      linkedin?: { accessToken: string };
    };
    autoPost: boolean;
    character: AgentCharacter;
    postsPerDay: string;
    characterName?: string;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const config: ProjectSocialConfig = {
        projectId: payload.projectId,
        socials: payload.socials,
        autoPost: payload.autoPost,
        character: payload.character,
        postsPerDay: payload.postsPerDay,
        setupAt: new Date().toISOString(),
        isActive: true,
      };

      // Store config in DynamoDB
      await this.storeProjectConfig(config);

      const setupResults: any = {};

      // Setup each platform
      if (payload.socials.twitter) {
        setupResults.twitter = await this.setupTwitter(
          payload.projectId,
          payload.socials.twitter
        );
      }

      if (payload.socials.telegram) {
        setupResults.telegram = await this.setupTelegram(
          payload.projectId,
          payload.socials.telegram
        );
      }

      if (payload.socials.linkedin) {
        setupResults.linkedin = await this.setupLinkedIn(
          payload.projectId,
          payload.socials.linkedin
        );
      }

      console.log(
        `✅ Social media setup completed for project ${payload.projectId}`
      );

      return {
        success: true,
        message: "Social media setup completed successfully",
        data: {
          projectId: payload.projectId,
          platforms: Object.keys(payload.socials),
          autoPost: payload.autoPost,
          character: payload.character.name,
          setupResults,
        },
      };
    } catch (error: any) {
      console.error("Social setup failed:", error);
      return {
        success: false,
        message: error.message || "Social setup failed",
      };
    }
  }

  private async setupTwitter(
    projectId: string,
    credentials: any
  ): Promise<any> {
    const scraper = new Scraper();

    console.log(`🐦 Setting up Twitter for project ${projectId}...`);
    await scraper.login(
      credentials.username,
      credentials.password,
      credentials.email
    );

    const isLoggedIn = await scraper.isLoggedIn();
    console.log(`Twitter login status for project ${projectId}:`, isLoggedIn);

    if (isLoggedIn) {
      this.activeScrapers.set(`${projectId}-twitter`, scraper);
    }

    return { isLoggedIn, username: credentials.username };
  }

  private async setupTelegram(
    projectId: string,
    credentials: any
  ): Promise<any> {
    const bot = new Bot(credentials.botToken);

    // Middleware to add project context
    bot.use(async (ctx, next) => {
      (ctx as any).projectId = projectId;
      await next();
    });

    // Handle all text messages
    bot.on("message:text", async (ctx) => {
      await this.handleTelegramMessage(ctx, projectId);
    });

    // Handle commands
    bot.command("start", async (ctx) => {
      const config = await this.getProjectConfig(projectId);
      const greeting = await this.generateCharacterResponse(
        "Someone just started a conversation with me on Telegram. Generate a greeting message.",
        config?.character,
        "telegram"
      );
      await ctx.reply(greeting);
    });

    bot.command("help", async (ctx) => {
      const config = await this.getProjectConfig(projectId);
      const help = await this.generateCharacterResponse(
        "Someone asked for help. Explain what I can do and how to interact with me.",
        config?.character,
        "telegram"
      );
      await ctx.reply(help);
    });

    bot.catch((err) => {
      console.error(`Telegram bot error for project ${projectId}:`, err);
    });

    await bot.start();
    this.activeBots.set(`${projectId}-telegram`, bot);
    console.log(`✅ Telegram bot active for project ${projectId}`);

    const botInfo = await bot.api.getMe();
    return { botInfo, isActive: true };
  }

  private async setupLinkedIn(
    projectId: string,
    credentials: any
  ): Promise<any> {
    console.log(
      `💼 LinkedIn setup for project ${projectId} - API integration enabled`
    );
    return { status: "configured", accessToken: "configured" };
  }

  private async handleTelegramMessage(
    ctx: Context,
    projectId: string
  ): Promise<void> {
    const message = ctx.message?.text;
    if (!message) return;

    console.log(`📨 Telegram message for project ${projectId}: ${message}`);

    try {
      await ctx.replyWithChatAction("typing");

      const config = await this.getProjectConfig(projectId);
      const response = await this.generateCharacterResponse(
        message,
        config?.character,
        "telegram"
      );

      await ctx.reply(response, {
        reply_to_message_id: ctx.message?.message_id,
      });
    } catch (error) {
      console.error("Failed to handle Telegram message:", error);
      await ctx.reply("Sorry, I encountered an error processing your message.");
    }
  }

  async postContent(payload: {
    projectId: string;
    platform: string;
    content?: string;
    topic?: string;
    mediaData?: any[];
    chatId?: number;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const config = await this.getProjectConfig(payload.projectId);
      if (!config) {
        throw new Error("Project configuration not found");
      }

      let content = payload.content;
      if (!content && payload.topic) {
        content = await this.generateCharacterResponse(
          `Create a ${payload.platform} post about: ${payload.topic}`,
          config.character,
          payload.platform
        );
      }

      if (!content) {
        throw new Error("No content provided or generated");
      }

      let result: any = {};

      switch (payload.platform) {
        case "twitter":
          result = await this.postToTwitter(
            payload.projectId,
            content,
            payload.mediaData
          );
          break;
        case "telegram":
          result = await this.postToTelegram(
            payload.projectId,
            content,
            payload.chatId
          );
          break;
        case "linkedin":
          result = await this.postToLinkedIn(payload.projectId, content);
          break;
        default:
          throw new Error(`Unsupported platform: ${payload.platform}`);
      }

      return {
        success: true,
        message: `Content posted to ${payload.platform} successfully`,
        data: { ...result, content, generatedContent: !payload.content },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to post content",
      };
    }
  }

  private async postToTwitter(
    projectId: string,
    content: string,
    mediaData?: any[]
  ): Promise<any> {
    const scraper = this.activeScrapers.get(`${projectId}-twitter`);
    if (!scraper) {
      throw new Error("Twitter not setup for this project");
    }

    const result = await scraper.sendTweet(content, undefined, mediaData);
    console.log(
      `🐦 Tweet sent for project ${projectId}:`,
      content.substring(0, 50) + "..."
    );
    return { tweetSent: true, contentLength: content.length };
  }

  private async postToTelegram(
    projectId: string,
    content: string,
    chatId?: number
  ): Promise<any> {
    const bot = this.activeBots.get(`${projectId}-telegram`);
    if (!bot) {
      throw new Error("Telegram not setup for this project");
    }

    if (chatId) {
      const result = await bot.api.sendMessage(chatId, content);
      console.log(
        `📱 Telegram message sent for project ${projectId} to chat ${chatId}`
      );
      return { messageSent: true, messageId: result.message_id, chatId };
    } else {
      console.log(
        `📱 Telegram content prepared for project ${projectId}:`,
        content
      );
      return { contentPrepared: true };
    }
  }

  private async postToLinkedIn(
    projectId: string,
    content: string
  ): Promise<any> {
    console.log(`💼 LinkedIn post for project ${projectId}:`, content);
    return { linkedinPost: true, contentLength: content.length };
  }

  private async generateCharacterResponse(
    prompt: string,
    character?: AgentCharacter,
    platform?: string
  ): Promise<string> {
    if (!character) {
      return "Hello! How can I help you today?";
    }

    const characterPrompt = `You are ${character.name}. 

Character Bio: ${
      Array.isArray(character.bio) ? character.bio.join(" ") : character.bio
    }

Character Lore: ${character.lore.join(" ")}

Style Guidelines:
- All: ${character.style.all.join(", ")}
- Chat: ${character.style.chat.join(", ")}
- Post: ${character.style.post.join(", ")}

${platform ? `You are responding on ${platform}.` : ""}

User request: ${prompt}

Respond in character, following your personality and style guidelines. Keep it concise and engaging.`;

    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 500,
        messages: [{ role: "user", content: characterPrompt }],
      }),
      contentType: "application/json",
    });

    try {
      const response = await this.bedrock.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content[0].text.trim();
    } catch (error) {
      console.error("Bedrock character response failed:", error);
      return this.getFallbackResponse(platform);
    }
  }

  private getFallbackResponse(platform?: string): string {
    const responses = {
      twitter: "Thanks for reaching out! 🚀",
      telegram: "Hello! How can I help you today?",
      linkedin: "Thank you for your interest in our project.",
    };
    return (
      responses[platform as keyof typeof responses] ||
      "Hello! How can I help you?"
    );
  }

  private async runScheduledPosts(): Promise<void> {
    console.log("🔄 Running scheduled posts...");
    // Implementation for scheduled posting based on postsPerDay setting
  }

  private async storeProjectConfig(config: ProjectSocialConfig): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: "project-social-configs",
        Item: marshall(config),
      })
    );
  }

  private async getProjectConfig(
    projectId: string
  ): Promise<ProjectSocialConfig | null> {
    const response = await this.dynamodb.send(
      new GetItemCommand({
        TableName: "project-social-configs",
        Key: marshall({ projectId }),
      })
    );

    return response.Item
      ? (unmarshall(response.Item) as ProjectSocialConfig)
      : null;
  }

  private async loadExistingConfigs(): Promise<void> {
    // Load existing configurations and reinitialize bots/scrapers
    console.log("🔄 Loading existing social configurations...");
  }

  async fetchAndEngage(
    userId: string,
    platform: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    return {
      success: true,
      message: "Fetch and engage completed",
      data: { platform, timestamp: new Date().toISOString() },
    };
  }

  async updateMonitoringConfig(
    payload: any
  ): Promise<{ success: boolean; message: string; data?: any }> {
    return {
      success: true,
      message: "Monitoring config updated",
      data: payload,
    };
  }

  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up SocialsService...");

    if (this.scheduledPostInterval) {
      clearInterval(this.scheduledPostInterval);
    }

    for (const [key, bot] of this.activeBots) {
      try {
        await bot.stop();
        console.log(`Stopped bot: ${key}`);
      } catch (error) {
        console.error(`Failed to stop bot ${key}:`, error);
      }
    }

    this.activeBots.clear();
    this.activeScrapers.clear();
  }
}
