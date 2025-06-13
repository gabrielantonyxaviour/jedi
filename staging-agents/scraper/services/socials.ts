// services/SocialsService.ts
import { randomUUID } from "crypto";
import { Scraper } from "agent-twitter-client";
import { Bot, Context, webhookCallback } from "grammy";
import fs from "fs";
import path from "path";

interface SocialCredentials {
  userId: string;
  platform: "twitter" | "telegram" | "linkedin";
  credentials: {
    username?: string;
    password?: string;
    email?: string;
    cookies?: any[];
    botToken?: string;
    accessToken?: string;
  };
  isActive: boolean;
  setupAt: string;
}

interface MonitoringConfig {
  userId: string;
  platform: "twitter" | "linkedin";
  hashtags: string[];
  searchTerms: string[];
  homePageEnabled: boolean;
  autoReply: boolean;
  autoReact: boolean;
  autoRepost: boolean;
  lastFetchTime: number;
}

export class SocialsService {
  private credentials: Map<string, SocialCredentials> = new Map();
  private monitoringConfigs: Map<string, MonitoringConfig> = new Map();
  private activeScrapers: Map<string, Scraper> = new Map();
  private activeBots: Map<string, Bot> = new Map();
  private dataDir: string;
  private scheduledFetchInterval?: NodeJS.Timeout;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), "data");
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.loadData();
  }

  async initialize(): Promise<void> {
    console.log("🚀 Initializing SocialsService...");
    await this.initializeExistingBots();
  }

  async startScheduledMonitoring(): Promise<void> {
    if (this.scheduledFetchInterval) {
      clearInterval(this.scheduledFetchInterval);
    }

    this.scheduledFetchInterval = setInterval(async () => {
      await this.runScheduledFetch();
    }, 5 * 60 * 1000); // Every 5 minutes

    console.log("📊 Scheduled monitoring started");
  }

  async stopScheduledMonitoring(): Promise<void> {
    if (this.scheduledFetchInterval) {
      clearInterval(this.scheduledFetchInterval);
      this.scheduledFetchInterval = undefined;
      console.log("📊 Scheduled monitoring stopped");
    }
  }

  async setupSocial(payload: {
    userId: string;
    platform: "twitter" | "telegram" | "linkedin";
    credentials: any;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const { userId, platform, credentials } = payload;

      const credentialData: SocialCredentials = {
        userId,
        platform,
        credentials,
        isActive: true,
        setupAt: new Date().toISOString(),
      };

      this.credentials.set(`${userId}-${platform}`, credentialData);
      this.saveData();

      let setupResult: any = {};

      switch (platform) {
        case "twitter":
          setupResult = await this.setupTwitter(userId, credentials);
          break;
        case "telegram":
          setupResult = await this.setupTelegram(userId, credentials);
          break;
        case "linkedin":
          setupResult = await this.setupLinkedIn(userId, credentials);
          break;
      }

      console.log(`✅ ${platform} setup completed for user ${userId}`);

      return {
        success: true,
        message: `${platform} setup completed successfully`,
        data: setupResult,
      };
    } catch (error: any) {
      console.error("Setup failed:", error);
      return {
        success: false,
        message: error.message || "Setup failed",
      };
    }
  }

  private async setupTwitter(userId: string, credentials: any): Promise<any> {
    const scraper = new Scraper();

    if (credentials.cookies) {
      await scraper.setCookies(credentials.cookies);
    } else {
      console.log(`🐦 Logging into Twitter for ${userId}...`);
      await scraper.login(
        credentials.username,
        credentials.password,
        credentials.email
      );

      const cookies = await scraper.getCookies();
      credentials.cookies = cookies;

      const key = `${userId}-twitter`;
      const existing = this.credentials.get(key);
      if (existing) {
        existing.credentials.cookies = cookies;
        this.credentials.set(key, existing);
        this.saveData();
      }
    }

    const isLoggedIn = await scraper.isLoggedIn();
    console.log(`Twitter login status for ${userId}:`, isLoggedIn);

    this.activeScrapers.set(`${userId}-twitter`, scraper);

    return { isLoggedIn, hasCookies: !!credentials.cookies };
  }

  private async setupTelegram(userId: string, credentials: any): Promise<any> {
    const bot = new Bot(credentials.botToken);

    // Middleware to add userId context
    bot.use(async (ctx, next) => {
      (ctx as any).userId = userId;
      await next();
    });

    // Handle all text messages
    bot.on("message:text", async (ctx) => {
      await this.handleTelegramMessage(ctx);
    });

    // Handle commands
    bot.command("start", async (ctx) => {
      await ctx.reply(
        "Hello! I'm your AI assistant. How can I help you today?"
      );
    });

    bot.command("help", async (ctx) => {
      await ctx.reply(`
Available commands:
/start - Get started
/help - Show this help
/status - Check bot status

Or just send me any message and I'll respond!
     `);
    });

    bot.command("status", async (ctx) => {
      const status = await this.getUserStatus(userId);
      await ctx.reply(`Status: ${JSON.stringify(status, null, 2)}`);
    });

    bot.catch((err) => {
      console.error(`Telegram bot error for ${userId}:`, err);
    });

    await bot.start();

    this.activeBots.set(`${userId}-telegram`, bot);
    console.log(`✅ Grammy Telegram bot active for ${userId}`);

    const botInfo = await bot.api.getMe();
    return { botInfo, isActive: true };
  }

  private async setupLinkedIn(userId: string, credentials: any): Promise<any> {
    console.log(
      `LinkedIn setup for ${userId} - polling-based monitoring enabled`
    );
    return { status: "polling_enabled" };
  }

  private async handleTelegramMessage(ctx: Context): Promise<void> {
    const userId = (ctx as any).userId;
    const message = ctx.message?.text;

    if (!message) return;

    console.log(`📨 Telegram message from user ${userId}: ${message}`);

    try {
      await ctx.replyWithChatAction("typing");

      const response = await this.generateSimpleResponse(message, "telegram");
      await ctx.reply(response, {
        reply_to_message_id: ctx.message?.message_id,
      });
    } catch (error) {
      console.error("Failed to handle Telegram message:", error);
      await ctx.reply("Sorry, I encountered an error processing your message.");
    }
  }

  async postContent(payload: {
    userId: string;
    platform: string;
    content: string;
    mediaData?: any[];
    chatId?: number;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const { userId, platform, content, mediaData, chatId } = payload;
      let result: any = {};

      switch (platform) {
        case "twitter":
          result = await this.postToTwitter(userId, content, mediaData);
          break;
        case "telegram":
          result = await this.postToTelegram(userId, content, chatId);
          break;
        case "linkedin":
          result = await this.postToLinkedIn(userId, content);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      return {
        success: true,
        message: `Content posted to ${platform} successfully`,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to post content",
      };
    }
  }

  private async postToTwitter(
    userId: string,
    content: string,
    mediaData?: any[]
  ): Promise<any> {
    const scraper = this.activeScrapers.get(`${userId}-twitter`);
    if (!scraper) {
      throw new Error("Twitter not setup for this user");
    }

    const result = await scraper.sendTweet(content, undefined, mediaData);
    console.log(
      `🐦 Tweet sent for ${userId}:`,
      content.substring(0, 50) + "..."
    );
    return { tweetSent: true, contentLength: content.length };
  }

  private async postToTelegram(
    userId: string,
    content: string,
    chatId?: number
  ): Promise<any> {
    const bot = this.activeBots.get(`${userId}-telegram`);
    if (!bot) {
      throw new Error("Telegram not setup for this user");
    }

    if (chatId) {
      const result = await bot.api.sendMessage(chatId, content);
      console.log(`📱 Telegram message sent for ${userId} to chat ${chatId}`);
      return { messageSent: true, messageId: result.message_id, chatId };
    } else {
      console.log(`📱 Telegram content prepared for ${userId}:`, content);
      return { contentPrepared: true };
    }
  }

  private async postToLinkedIn(userId: string, content: string): Promise<any> {
    console.log(`💼 LinkedIn post for ${userId}:`, content);
    return { linkedinPost: true, contentLength: content.length };
  }

  async updateMonitoringConfig(payload: {
    userId: string;
    platform: string;
    hashtags?: string[];
    searchTerms?: string[];
    homePageEnabled?: boolean;
    autoReply?: boolean;
    autoReact?: boolean;
    autoRepost?: boolean;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const key = `${payload.userId}-${payload.platform}`;
      const existing = this.monitoringConfigs.get(key) || {
        userId: payload.userId,
        platform: payload.platform as any,
        hashtags: [],
        searchTerms: [],
        homePageEnabled: false,
        autoReply: false,
        autoReact: false,
        autoRepost: false,
        lastFetchTime: 0,
      };

      const updated = { ...existing, ...payload };
      this.monitoringConfigs.set(key, updated);
      this.saveData();

      console.log(
        `📊 Monitoring config updated for ${payload.userId}-${payload.platform}`
      );

      return {
        success: true,
        message: "Monitoring configuration updated successfully",
        data: updated,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to update monitoring config",
      };
    }
  }

  async fetchAndEngage(
    userId: string,
    platform: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const config = this.monitoringConfigs.get(`${userId}-${platform}`);
      if (!config) {
        return {
          success: false,
          message: "No monitoring configuration found",
        };
      }

      let result: any = {};

      if (platform === "twitter") {
        result = await this.fetchTwitterContent(userId, config);
      } else {
        throw new Error(`Fetch and engage not implemented for ${platform}`);
      }

      return {
        success: true,
        message: "Fetch and engage completed successfully",
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Fetch and engage failed",
      };
    }
  }

  private async runScheduledFetch(): Promise<void> {
    console.log("🔄 Running scheduled fetch...");

    for (const [key, config] of this.monitoringConfigs) {
      try {
        await this.fetchAndEngage(config.userId, config.platform);
      } catch (error) {
        console.error(`Failed to fetch for ${key}:`, error);
      }
    }
  }

  private async fetchTwitterContent(
    userId: string,
    config: MonitoringConfig
  ): Promise<any> {
    const scraper = this.activeScrapers.get(`${userId}-twitter`);
    if (!scraper) {
      throw new Error("Twitter scraper not found");
    }

    let totalProcessed = 0;
    let actions = { likes: 0, retweets: 0, replies: 0 };

    try {
      for (const hashtag of config.hashtags) {
        console.log(`🔍 Fetching tweets for hashtag: ${hashtag}`);
        const tweets = await scraper.searchTweets(hashtag, 5);
        const processed = await this.processTweets(
          userId,
          tweets,
          scraper,
          config
        );
        totalProcessed += processed.count;
        actions.likes += processed.actions.likes;
        actions.retweets += processed.actions.retweets;
        actions.replies += processed.actions.replies;
      }

      for (const term of config.searchTerms) {
        console.log(`🔍 Fetching tweets for term: ${term}`);
        const tweets = await scraper.searchTweets(term, 5);
        const processed = await this.processTweets(
          userId,
          tweets,
          scraper,
          config
        );
        totalProcessed += processed.count;
        actions.likes += processed.actions.likes;
        actions.retweets += processed.actions.retweets;
        actions.replies += processed.actions.replies;
      }

      config.lastFetchTime = Date.now();
      this.saveData();

      return { totalProcessed, actions, lastFetch: new Date().toISOString() };
    } catch (error) {
      console.error(`Error fetching Twitter content for ${userId}:`, error);
      throw error;
    }
  }

  private async processTweets(
    userId: string,
    tweets: any[],
    scraper: Scraper,
    config: MonitoringConfig
  ): Promise<{ count: number; actions: any }> {
    let actions = { likes: 0, retweets: 0, replies: 0 };

    for (const tweet of tweets) {
      try {
        const engagement = this.shouldEngageWithTweet(tweet);

        if (config.autoReact && engagement.like) {
          await scraper.likeTweet(tweet.id);
          actions.likes++;
          console.log(`❤️ Liked tweet: ${tweet.text?.substring(0, 30)}...`);
        }

        if (config.autoRepost && engagement.retweet) {
          await scraper.retweet(tweet.id);
          actions.retweets++;
          console.log(`🔄 Retweeted: ${tweet.text?.substring(0, 30)}...`);
        }

        if (config.autoReply && engagement.reply) {
          const reply = await this.generateSimpleResponse(
            tweet.text,
            "twitter"
          );
          await scraper.sendTweet(reply, tweet.id);
          actions.replies++;
          console.log(`💬 Replied to: ${tweet.text?.substring(0, 30)}...`);
        }
      } catch (error) {
        console.error("Error processing tweet:", error);
      }
    }

    return { count: tweets.length, actions };
  }

  private shouldEngageWithTweet(tweet: any): {
    reply: boolean;
    like: boolean;
    retweet: boolean;
  } {
    const hasQuestion = tweet.text?.includes("?");
    const isPopular = (tweet.likes || 0) > 10;
    const isRecent =
      Date.now() - new Date(tweet.timestamp || 0).getTime() < 60 * 60 * 1000;

    return {
      reply: hasQuestion && isRecent,
      like: isPopular || isRecent,
      retweet: isPopular && !tweet.isRetweet,
    };
  }

  private async generateSimpleResponse(
    content: string,
    platform: string
  ): Promise<string> {
    const responses = {
      twitter: [
        "Interesting perspective! 🤔",
        "Thanks for sharing this!",
        "Great point! 👍",
        "This is really insightful.",
      ],
      telegram: [
        "Thanks for your message! How can I help you?",
        "Hello! I received your message.",
        "Hi there! What would you like to know?",
        "That's interesting! Tell me more.",
      ],
    };

    const platformResponses =
      responses[platform as keyof typeof responses] || responses.twitter;
    return platformResponses[
      Math.floor(Math.random() * platformResponses.length)
    ];
  }

  async getUserStatus(userId: string): Promise<any> {
    const userCreds = Array.from(this.credentials.values()).filter(
      (c) => c.userId === userId
    );
    const userConfigs = Array.from(this.monitoringConfigs.values()).filter(
      (c) => c.userId === userId
    );

    return {
      userId,
      platforms: userCreds.map((c) => ({
        platform: c.platform,
        isActive: c.isActive,
        setupAt: c.setupAt,
        hasActiveConnection: this.hasActiveConnection(userId, c.platform),
      })),
      monitoring: userConfigs.map((c) => ({
        platform: c.platform,
        hashtags: c.hashtags,
        searchTerms: c.searchTerms,
        autoSettings: {
          reply: c.autoReply,
          react: c.autoReact,
          repost: c.autoRepost,
        },
        lastFetch: c.lastFetchTime
          ? new Date(c.lastFetchTime).toISOString()
          : null,
      })),
      scheduledMonitoringActive: !!this.scheduledFetchInterval,
    };
  }

  private hasActiveConnection(userId: string, platform: string): boolean {
    const key = `${userId}-${platform}`;
    switch (platform) {
      case "twitter":
        return this.activeScrapers.has(key);
      case "telegram":
        return this.activeBots.has(key);
      default:
        return false;
    }
  }

  getTelegramWebhook(userId: string) {
    const bot = this.activeBots.get(`${userId}-telegram`);
    if (!bot) {
      throw new Error("Telegram bot not found for user");
    }
    return webhookCallback(bot, "express");
  }

  private async initializeExistingBots(): Promise<void> {
    for (const [key, cred] of this.credentials) {
      if (cred.platform === "telegram" && cred.isActive) {
        try {
          await this.setupTelegram(cred.userId, cred.credentials);
        } catch (error) {
          console.error(
            `Failed to initialize existing Telegram bot for ${cred.userId}:`,
            error
          );
        }
      }
    }
  }

  private loadData(): void {
    try {
      const credsPath = path.join(this.dataDir, "credentials.json");
      const configsPath = path.join(this.dataDir, "monitoring.json");

      if (fs.existsSync(credsPath)) {
        const credsData = JSON.parse(fs.readFileSync(credsPath, "utf8"));
        this.credentials = new Map(Object.entries(credsData));
      }

      if (fs.existsSync(configsPath)) {
        const configsData = JSON.parse(fs.readFileSync(configsPath, "utf8"));
        this.monitoringConfigs = new Map(Object.entries(configsData));
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  }

  private saveData(): void {
    try {
      const credsPath = path.join(this.dataDir, "credentials.json");
      const configsPath = path.join(this.dataDir, "monitoring.json");

      fs.writeFileSync(
        credsPath,
        JSON.stringify(Object.fromEntries(this.credentials), null, 2)
      );
      fs.writeFileSync(
        configsPath,
        JSON.stringify(Object.fromEntries(this.monitoringConfigs), null, 2)
      );
    } catch (error) {
      console.error("Failed to save data:", error);
    }
  }

  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up SocialsService...");

    await this.stopScheduledMonitoring();

    // Stop all bots
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
