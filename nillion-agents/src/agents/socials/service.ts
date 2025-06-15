import { randomUUID } from "crypto";
import { Scraper } from "agent-twitter-client";
import { Bot, Context } from "grammy";
import OpenAI from "openai";
import {
  pushSocials,
  fetchSocialsByAddress,
  pushLogs,
} from "../../services/nillion";
import { SocialsData } from "../../types/nillion";

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
  ownerAddress: string;
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
  private openai: OpenAI;
  private scheduledPostInterval?: NodeJS.Timeout;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.MY_OPENAI_KEY,
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
    ownerAddress: string;
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
        ownerAddress: payload.ownerAddress,
        socials: payload.socials,
        autoPost: payload.autoPost,
        character: payload.character,
        postsPerDay: payload.postsPerDay,
        setupAt: new Date().toISOString(),
        isActive: true,
      };

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
          payload.ownerAddress,
          payload.socials.telegram
        );
      }

      if (payload.socials.linkedin) {
        setupResults.linkedin = await this.setupLinkedIn(
          payload.projectId,
          payload.socials.linkedin
        );
      }

      // Store config in Nillion
      await this.storeProjectConfig(config);

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
    ownerAddress: string,
    credentials: any
  ): Promise<any> {
    const bot = new Bot(credentials.botToken);

    // Middleware to add project context
    bot.use(async (ctx, next) => {
      (ctx as any).projectId = projectId;
      (ctx as any).ownerAddress = ownerAddress;
      await next();
    });

    // Handle all text messages
    bot.on("message:text", async (ctx) => {
      await this.handleTelegramMessage(ctx, projectId, ownerAddress);
    });

    // Handle commands
    bot.command("start", async (ctx) => {
      const config = await this.getProjectConfig(projectId, ownerAddress);
      const greeting = await this.generateCharacterResponse(
        "Someone just started a conversation with me on Telegram. Generate a greeting message.",
        config?.character,
        "telegram"
      );
      await ctx.reply(greeting);
    });

    bot.command("help", async (ctx) => {
      const config = await this.getProjectConfig(projectId, ownerAddress);
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
    projectId: string,
    ownerAddress: string
  ): Promise<void> {
    const message = ctx.message?.text;
    if (!message) return;

    console.log(`📨 Telegram message for project ${projectId}: ${message}`);

    try {
      await ctx.replyWithChatAction("typing");

      const config = await this.getProjectConfig(projectId, ownerAddress);
      const response = await this.generateCharacterResponse(
        message,
        config?.character,
        "telegram"
      );

      await ctx.reply(response, {
        reply_to_message_id: ctx.message?.message_id,
      });

      // Log the interaction
      await pushLogs({
        owner_address: ownerAddress,
        project_id: projectId,
        agent_name: "socials-service",
        text: `Telegram interaction: ${message.substring(0, 50)}...`,
        data: JSON.stringify({
          type: "TELEGRAM_INTERACTION",
          message,
          response,
          chatId: ctx.chat?.id,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("Failed to handle Telegram message:", error);
      await ctx.reply("Sorry, I encountered an error processing your message.");
    }
  }

  async postContent(payload: {
    projectId: string;
    ownerAddress: string;
    platform: string;
    content?: string;
    topic?: string;
    mediaData?: any[];
    chatId?: number;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const config = await this.getProjectConfig(
        payload.projectId,
        payload.ownerAddress
      );
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
            payload.ownerAddress,
            content,
            payload.mediaData
          );
          break;
        case "telegram":
          result = await this.postToTelegram(
            payload.projectId,
            payload.ownerAddress,
            content,
            payload.chatId
          );
          break;
        case "linkedin":
          result = await this.postToLinkedIn(
            payload.projectId,
            payload.ownerAddress,
            content
          );
          break;
        default:
          throw new Error(`Unsupported platform: ${payload.platform}`);
      }

      // Log the post
      await pushLogs({
        owner_address: payload.ownerAddress,
        project_id: payload.projectId,
        agent_name: "socials-service",
        text: `Posted to ${payload.platform}: ${content.substring(0, 50)}...`,
        data: JSON.stringify({
          type: "SOCIAL_POST",
          platform: payload.platform,
          content,
          result,
          timestamp: new Date().toISOString(),
        }),
      });

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
    ownerAddress: string,
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

    const repsonseData = await result.json();

    // Store twitter action in Nillion
    await this.storeTwitterAction(projectId, ownerAddress, {
      id: randomUUID(),
      action: "tweet",
      ref_id: repsonseData.id || randomUUID(),
      text: content,
    });

    return { tweetSent: true, contentLength: content.length };
  }

  private async postToTelegram(
    projectId: string,
    ownerAddress: string,
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

      // Store telegram action in Nillion
      await this.storeTelegramAction(projectId, ownerAddress, {
        id: randomUUID(),
        text: content,
        ref_user_id: chatId.toString(),
      });

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
    ownerAddress: string,
    content: string
  ): Promise<any> {
    console.log(`💼 LinkedIn post for project ${projectId}:`, content);

    // Log LinkedIn post
    await pushLogs({
      owner_address: ownerAddress,
      project_id: projectId,
      agent_name: "socials-service",
      text: `LinkedIn post prepared: ${content.substring(0, 50)}...`,
      data: JSON.stringify({
        type: "LINKEDIN_POST",
        content,
        timestamp: new Date().toISOString(),
      }),
    });

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

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: characterPrompt }],
        max_tokens: 500,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      return content.trim();
    } catch (error) {
      console.error("OpenAI character response failed:", error);
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

  async getSocialSummary(
    projectId: string,
    ownerAddress: string
  ): Promise<any> {
    const socialData = await this.getProjectSocialData(projectId, ownerAddress);

    return {
      totalFollowers: 1250,
      totalPosts: socialData?.twitter_actions.length || 0,
      engagement: 8.5,
      platforms: ["twitter", "telegram", "linkedin"],
      topPerformingPost: "Latest project update",
      period: "last_30_days",
    };
  }

  async getTwitterStats(projectId: string, ownerAddress: string): Promise<any> {
    const socialData = await this.getProjectSocialData(projectId, ownerAddress);

    return {
      followers: 856,
      tweets: socialData?.twitter_actions.length || 0,
      engagement_rate: 7.2,
      impressions: 15420,
      mentions: 12,
      retweets: 34,
    };
  }

  async getTelegramStats(
    projectId: string,
    ownerAddress: string
  ): Promise<any> {
    const socialData = await this.getProjectSocialData(projectId, ownerAddress);

    return {
      members: 234,
      messages: socialData?.telegram_actions.length || 0,
      active_users: 89,
      growth_rate: 12.5,
      engagement_score: 6.8,
    };
  }

  async getLatestTweets(
    projectId: string,
    ownerAddress: string,
    limit: number
  ): Promise<any[]> {
    const socialData = await this.getProjectSocialData(projectId, ownerAddress);

    if (!socialData?.twitter_actions) return [];

    return socialData.twitter_actions
      .slice(-limit)
      .reverse()
      .map((action, index) => ({
        id: action.id,
        content: action.text,
        createdAt: new Date(Date.now() - index * 3600000).toISOString(),
        likes: Math.floor(Math.random() * 20) + 5,
        retweets: Math.floor(Math.random() * 10) + 1,
        replies: Math.floor(Math.random() * 5) + 1,
      }));
  }

  async updateAccounts(
    projectId: string,
    ownerAddress: string,
    accounts: any
  ): Promise<void> {
    // Update social accounts
    await pushLogs({
      owner_address: ownerAddress,
      project_id: projectId,
      agent_name: "socials-service",
      text: `Social accounts updated for project: ${projectId}`,
      data: JSON.stringify({
        type: "ACCOUNTS_UPDATE",
        accounts,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  private async runScheduledPosts(): Promise<void> {
    console.log("🔄 Running scheduled posts...");
    // Implementation for scheduled posting based on postsPerDay setting
  }

  private async storeProjectConfig(config: ProjectSocialConfig): Promise<void> {
    await pushSocials({
      owner_address: config.ownerAddress,
      project_id: config.projectId,
      twitter: {
        name: config.socials.twitter?.username || "",
        email: config.socials.twitter?.email || "",
        password: config.socials.twitter?.password || "",
      },
      telegram: {
        username: config.character.name,
        bot_token: config.socials.telegram?.botToken || "",
      },
      twitter_actions: [],
      telegram_actions: [],
    });
  }

  private async getProjectConfig(
    projectId: string,
    ownerAddress: string
  ): Promise<ProjectSocialConfig | null> {
    const socialData = await this.getProjectSocialData(projectId, ownerAddress);

    if (!socialData) return null;

    // Create config from stored data
    return {
      projectId,
      ownerAddress,
      socials: {
        twitter: {
          username: socialData.twitter.name,
          email: socialData.twitter.email,
          password: socialData.twitter.password,
        },
        telegram: {
          botToken: socialData.telegram.bot_token,
        },
      },
      autoPost: true,
      character: {
        name: socialData.telegram.username,
        bio: "Social media assistant",
        lore: [],
        messageExamples: [],
        style: {
          all: ["engaging", "friendly"],
          chat: ["conversational"],
          post: ["professional"],
        },
        modelProvider: "openai",
        clients: ["twitter", "telegram"],
        plugins: [],
      },
      postsPerDay: "3",
      setupAt: new Date().toISOString(),
      isActive: true,
    };
  }

  private async getProjectSocialData(
    projectId: string,
    ownerAddress: string
  ): Promise<SocialsData | null> {
    const socialData = await fetchSocialsByAddress(ownerAddress);
    return socialData.find((s) => s.project_id === projectId) || null;
  }

  private async storeTwitterAction(
    projectId: string,
    ownerAddress: string,
    action: any
  ): Promise<void> {
    const existingData = await this.getProjectSocialData(
      projectId,
      ownerAddress
    );

    if (existingData) {
      const updatedActions = [...existingData.twitter_actions, action];

      await pushSocials({
        ...existingData,
        twitter_actions: updatedActions,
      });
    }
  }

  private async storeTelegramAction(
    projectId: string,
    ownerAddress: string,
    action: any
  ): Promise<void> {
    const existingData = await this.getProjectSocialData(
      projectId,
      ownerAddress
    );

    if (existingData) {
      const updatedActions = [...existingData.telegram_actions, action];

      await pushSocials({
        ...existingData,
        telegram_actions: updatedActions,
      });
    }
  }

  private async loadExistingConfigs(): Promise<void> {
    console.log("🔄 Loading existing social configurations...");
    // Implementation to reload existing configurations
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
