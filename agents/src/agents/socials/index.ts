// agents/social-media-agent.ts
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { SocialsService } from "./service";
import { wrapMetaLlamaPrompt } from "@/utils/helper";

export class SocialsAgent {
  private sqs: SQSClient;
  private queueUrl: string;
  private socialsService: SocialsService;
  private orchestratorQueue: string;
  private bedrock: BedrockRuntimeClient;

  constructor() {
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.queueUrl = process.env.SOCIALS_QUEUE_URL!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
    this.bedrock = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.BEDROCK_AWS_KEY_ID!,
        secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.socialsService = new SocialsService();
  }

  async startListening(): Promise<void> {
    console.log("🚀 Starting socials agent...");
    await this.socialsService.initialize();
    await this.socialsService.startScheduledPosting();
    this.pollSQSMessages();
  }

  private async pollSQSMessages(): Promise<void> {
    while (true) {
      try {
        const result = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
          })
        );

        if (result.Messages) {
          for (const message of result.Messages) {
            try {
              const task = JSON.parse(message.Body!);
              await this.processTask(task);

              await this.sqs.send(
                new DeleteMessageCommand({
                  QueueUrl: this.queueUrl,
                  ReceiptHandle: message.ReceiptHandle!,
                })
              );
            } catch (error) {
              console.error("Error processing message:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error polling SQS:", error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  async processTask(task: any): Promise<void> {
    console.log(`📱 Processing task: ${task.type}`);

    const characterInfo = task.characterInfo;
    let characterResponse = "";

    try {
      let result;

      switch (task.type) {
        case "SETUP_SOCIAL":
          result = await this.socialsService.setupSocial({
            ...task.payload,
            workflowId: task.workflowId,
            taskId: task.taskId,
          });
          break;

        case "POST_CONTENT":
          result = await this.socialsService.postContent(task.payload);
          break;

        case "TWEET_ABOUT":
          result = await this.tweetAbout(task.payload);
          break;

        case "MODIFY_CHARACTER":
          result = await this.modifyCharacter(task.payload);
          break;

        case "SET_FREQUENCY":
          result = await this.setFrequency(task.payload);
          break;

        case "CHANGE_ACCOUNTS":
          result = await this.changeAccounts(task.payload);
          break;

        case "GET_SOCIAL_SUMMARY":
          result = await this.getSocialSummary(task.payload);
          break;

        case "GET_X_SUMMARY":
          result = await this.getXSummary(task.payload);
          break;

        case "GET_TELEGRAM_SUMMARY":
          result = await this.getTelegramSummary(task.payload);
          break;

        case "GET_LINKEDIN_SUMMARY":
          result = await this.getLinkedInSummary(task.payload);
          break;

        case "GET_LATEST_TWEETS":
          result = await this.getLatestTweets(task.payload);
          break;

        case "GET_LATEST_LINKEDIN_POSTS":
          result = await this.getLatestLinkedInPosts(task.payload);
          break;

        case "FETCH_AND_ENGAGE":
          result = await this.socialsService.fetchAndEngage(
            task.payload.userId,
            task.payload.platform
          );
          break;

        case "UPDATE_MONITORING":
          result = await this.socialsService.updateMonitoringConfig(
            task.payload
          );
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      if (characterInfo) {
        characterResponse = await this.generateCharacterResponse(
          characterInfo,
          result
        );
      }

      if (!result.success) {
        throw new Error(result.message);
      }

      await this.reportTaskCompletion(task.taskId, task.workflowId, {
        ...result,
        characterResponse,
      });

      console.log(`✅ Task completed: ${task.type}`);
    } catch (error: any) {
      if (characterInfo) {
        characterResponse = await this.generateErrorResponse(characterInfo);
      }

      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        null,
        error.message,
        characterResponse
      );

      console.error(`❌ Task failed: ${error.message}`);
      throw error;
    }
  }

  private async generateCharacterResponse(
    characterInfo: any,
    result: any
  ): Promise<string> {
    const prompt = `You are ${
      characterInfo.name || "a social media assistant"
    } with the following personality: ${
      characterInfo.personality || "helpful and engaging"
    }

The social media task has been completed successfully with these results:
${JSON.stringify(result, null, 2)}

Generate a brief response (1-2 sentences) in character that acknowledges the successful completion of the social media task. Stay true to the character's personality and speaking style.`;

    const command = new InvokeModelCommand({
      modelId: "meta.llama3-70b-instruct-v1:0",
      body: JSON.stringify({
        prompt: wrapMetaLlamaPrompt(prompt),
        max_gen_len: 200,
        temperature: 0.5,
        top_p: 0.9,
      }),
      contentType: "application/json",
    });

    try {
      const response = await this.bedrock.send(command);
      const { generation: characterResponse } = JSON.parse(
        new TextDecoder().decode(response.body)
      );
      return characterResponse;
    } catch (error) {
      console.error("Bedrock character response failed:", error);
      return "Social media task completed successfully! 🚀";
    }
  }

  private async generateErrorResponse(characterInfo: any): Promise<string> {
    const prompt = `You are ${
      characterInfo.name || "a social media assistant"
    } with the following personality: ${
      characterInfo.personality || "helpful and engaging"
    }

A social media task has failed to complete. Generate a brief response (1-2 sentences) in character that acknowledges the failure while staying positive and solution-oriented. Stay true to the character's personality and speaking style.`;

    const command = new InvokeModelCommand({
      modelId: "meta.llama3-70b-instruct-v1:0",
      body: JSON.stringify({
        prompt: wrapMetaLlamaPrompt(prompt),
        max_gen_len: 200,
        temperature: 0.5,
        top_p: 0.9,
      }),
      contentType: "application/json",
    });

    try {
      const response = await this.bedrock.send(command);
      const { generation: errorResponse } = JSON.parse(
        new TextDecoder().decode(response.body)
      );
      return errorResponse;
    } catch (error) {
      console.error("Bedrock error response failed:", error);
      return "Something went wrong with the social media task. Let me try again! 💪";
    }
  }

  // Keep all the existing methods (tweetAbout, modifyCharacter, etc.) unchanged
  async tweetAbout(payload: {
    projectId: string;
    content: string;
    media?: string[];
  }): Promise<any> {
    console.log(`🐦 Tweeting about project: ${payload.projectId}`);
    return await this.socialsService.postContent({
      projectId: payload.projectId,
      platform: "twitter",
      content: payload.content,
      mediaData: payload.media,
    });
  }

  async modifyCharacter(payload: {
    projectId: string;
    personality: string;
    tone: string;
  }): Promise<any> {
    console.log(`🎭 Modifying character for project: ${payload.projectId}`);
    return {
      success: true,
      projectId: payload.projectId,
      personality: payload.personality,
      tone: payload.tone,
      updatedAt: new Date().toISOString(),
    };
  }

  async setFrequency(payload: {
    projectId: string;
    frequency: string;
    platforms: string[];
  }): Promise<any> {
    console.log(`⏰ Setting frequency for project: ${payload.projectId}`);
    return {
      success: true,
      projectId: payload.projectId,
      frequency: payload.frequency,
      platforms: payload.platforms,
      updatedAt: new Date().toISOString(),
    };
  }

  async changeAccounts(payload: {
    projectId: string;
    accounts: any;
  }): Promise<any> {
    console.log(`🔄 Changing accounts for project: ${payload.projectId}`);
    return {
      success: true,
      projectId: payload.projectId,
      accounts: payload.accounts,
      updatedAt: new Date().toISOString(),
    };
  }

  async getSocialSummary(payload: { projectId: string }): Promise<any> {
    console.log(`📊 Getting social summary for project: ${payload.projectId}`);
    return {
      success: true,
      projectId: payload.projectId,
      summary: {
        totalFollowers: 1250,
        totalPosts: 45,
        engagement: 8.5,
        platforms: ["twitter", "linkedin", "telegram"],
        topPerformingPost: "Latest project update",
        period: "last_30_days",
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getXSummary(payload: { projectId: string }): Promise<any> {
    console.log(`🐦 Getting X summary for project: ${payload.projectId}`);
    return {
      success: true,
      platform: "twitter",
      projectId: payload.projectId,
      stats: {
        followers: 856,
        tweets: 23,
        engagement_rate: 7.2,
        impressions: 15420,
        mentions: 12,
        retweets: 34,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getTelegramSummary(payload: { projectId: string }): Promise<any> {
    console.log(
      `📱 Getting Telegram summary for project: ${payload.projectId}`
    );
    return {
      success: true,
      platform: "telegram",
      projectId: payload.projectId,
      stats: {
        members: 234,
        messages: 156,
        active_users: 89,
        growth_rate: 12.5,
        engagement_score: 6.8,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getLinkedInSummary(payload: { projectId: string }): Promise<any> {
    console.log(
      `💼 Getting LinkedIn summary for project: ${payload.projectId}`
    );
    return {
      success: true,
      platform: "linkedin",
      projectId: payload.projectId,
      stats: {
        connections: 342,
        posts: 18,
        post_views: 5670,
        profile_views: 234,
        engagement_rate: 9.1,
        shares: 23,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getLatestTweets(payload: {
    projectId: string;
    limit?: number;
  }): Promise<any> {
    console.log(`🐦 Getting latest tweets for project: ${payload.projectId}`);
    const tweets = [
      {
        id: "tweet_1",
        content: "Exciting project update! 🚀",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        likes: 12,
        retweets: 5,
        replies: 3,
      },
      {
        id: "tweet_2",
        content: "Working on something amazing...",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        likes: 8,
        retweets: 2,
        replies: 1,
      },
    ];

    return {
      success: true,
      platform: "twitter",
      projectId: payload.projectId,
      tweets: tweets.slice(0, payload.limit || 10),
      generatedAt: new Date().toISOString(),
    };
  }

  async getLatestLinkedInPosts(payload: {
    projectId: string;
    limit?: number;
  }): Promise<any> {
    console.log(
      `💼 Getting latest LinkedIn posts for project: ${payload.projectId}`
    );
    const posts = [
      {
        id: "post_1",
        content: "Professional project milestone achieved",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        likes: 45,
        comments: 12,
        shares: 8,
      },
      {
        id: "post_2",
        content: "Industry insights from our latest development",
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        likes: 32,
        comments: 7,
        shares: 5,
      },
    ];

    return {
      success: true,
      platform: "linkedin",
      projectId: payload.projectId,
      posts: posts.slice(0, payload.limit || 10),
      generatedAt: new Date().toISOString(),
    };
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string,
    characterResponse?: string
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
              result: result ? { ...result, characterResponse } : null,
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
