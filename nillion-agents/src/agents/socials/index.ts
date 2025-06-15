import OpenAI from "openai";
import { SocialsService } from "./service";
import {
  pushLogs,
  fetchLogs,
  fetchLogsByAddress,
} from "../../services/nillion";
import { LogsData } from "../../types/nillion";

export class SocialsAgent {
  private socialsService: SocialsService;
  private openai: OpenAI;
  private agentName: string = "social-media-agent";
  private isListening: boolean = false;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.MY_OPENAI_KEY,
    });
    this.socialsService = new SocialsService();
  }

  async startListening(): Promise<void> {
    console.log("🚀 Starting socials agent...");
    await this.socialsService.initialize();
    await this.socialsService.startScheduledPosting();
    this.isListening = true;
    this.pollLogMessages();
  }

  private async pollLogMessages(): Promise<void> {
    while (this.isListening) {
      try {
        // Poll for new task messages from logs
        const allLogs = await fetchLogs();

        // Filter for social media tasks that haven't been processed
        const socialTasks = allLogs.filter((log) => {
          try {
            const data = JSON.parse(log.data);
            return (
              data.type === "AGENT_TASK" &&
              data.targetAgent === "social" &&
              !data.processed
            );
          } catch {
            return false;
          }
        });

        for (const taskLog of socialTasks) {
          try {
            const taskData = JSON.parse(taskLog.data);
            await this.processTask(taskData.task);

            // Mark task as processed
            await pushLogs({
              owner_address: taskLog.owner_address,
              project_id: taskLog.project_id,
              agent_name: this.agentName,
              text: `Task processed: ${taskData.task.type}`,
              data: JSON.stringify({
                ...taskData,
                processed: true,
                processedAt: new Date().toISOString(),
              }),
            });
          } catch (error) {
            console.error("Error processing task message:", error);
          }
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        console.error("Error polling logs:", error);
        await new Promise((resolve) => setTimeout(resolve, 10000));
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

        case "POST_GRANT_APPLICATION":
          result = await this.postGrantApplication(task.payload);
          break;

        case "POST_MILESTONE_CREATED":
          result = await this.postMilestoneCreated(task.payload);
          break;

        case "POST_MILESTONE_COMPLETED":
          result = await this.postMilestoneCompleted(task.payload);
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

      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        task.payload.ownerAddress || "system",
        {
          ...result,
          characterResponse,
        }
      );

      console.log(`✅ Task completed: ${task.type}`);
    } catch (error: any) {
      if (characterInfo) {
        characterResponse = await this.generateErrorResponse(characterInfo);
      }

      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        task.payload.ownerAddress || "system",
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

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      return content.trim();
    } catch (error) {
      console.error("OpenAI character response failed:", error);
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

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      return content.trim();
    } catch (error) {
      console.error("OpenAI error response failed:", error);
      return "Something went wrong with the social media task. Let me try again! 💪";
    }
  }

  async tweetAbout(payload: {
    projectId: string;
    content: string;
    ownerAddress: string;
    media?: string[];
  }): Promise<any> {
    console.log(`🐦 Tweeting about project: ${payload.projectId}`);
    return await this.socialsService.postContent({
      projectId: payload.projectId,
      ownerAddress: payload.ownerAddress,
      platform: "twitter",
      content: payload.content,
      mediaData: payload.media,
    });
  }

  async modifyCharacter(payload: {
    projectId: string;
    ownerAddress: string;
    personality: string;
    tone: string;
  }): Promise<any> {
    console.log(`🎭 Modifying character for project: ${payload.projectId}`);

    // Log the character modification
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      agent_name: this.agentName,
      text: `Character modified for project: ${payload.projectId}`,
      data: JSON.stringify({
        type: "CHARACTER_MODIFICATION",
        personality: payload.personality,
        tone: payload.tone,
        timestamp: new Date().toISOString(),
      }),
    });

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
    ownerAddress: string;
    frequency: string;
    platforms: string[];
  }): Promise<any> {
    console.log(`⏰ Setting frequency for project: ${payload.projectId}`);

    // Log the frequency change
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      agent_name: this.agentName,
      text: `Posting frequency updated: ${payload.frequency}`,
      data: JSON.stringify({
        type: "FREQUENCY_UPDATE",
        frequency: payload.frequency,
        platforms: payload.platforms,
        timestamp: new Date().toISOString(),
      }),
    });

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
    ownerAddress: string;
    accounts: any;
  }): Promise<any> {
    console.log(`🔄 Changing accounts for project: ${payload.projectId}`);

    // Update accounts via socials service
    await this.socialsService.updateAccounts(
      payload.projectId,
      payload.ownerAddress,
      payload.accounts
    );

    return {
      success: true,
      projectId: payload.projectId,
      accounts: payload.accounts,
      updatedAt: new Date().toISOString(),
    };
  }

  async getSocialSummary(payload: {
    projectId: string;
    ownerAddress: string;
  }): Promise<any> {
    console.log(`📊 Getting social summary for project: ${payload.projectId}`);

    const summary = await this.socialsService.getSocialSummary(
      payload.projectId,
      payload.ownerAddress
    );

    return {
      success: true,
      projectId: payload.projectId,
      summary,
      generatedAt: new Date().toISOString(),
    };
  }

  async getXSummary(payload: {
    projectId: string;
    ownerAddress: string;
  }): Promise<any> {
    console.log(`🐦 Getting X summary for project: ${payload.projectId}`);

    const stats = await this.socialsService.getTwitterStats(
      payload.projectId,
      payload.ownerAddress
    );

    return {
      success: true,
      platform: "twitter",
      projectId: payload.projectId,
      stats,
      generatedAt: new Date().toISOString(),
    };
  }

  async getTelegramSummary(payload: {
    projectId: string;
    ownerAddress: string;
  }): Promise<any> {
    console.log(
      `📱 Getting Telegram summary for project: ${payload.projectId}`
    );

    const stats = await this.socialsService.getTelegramStats(
      payload.projectId,
      payload.ownerAddress
    );

    return {
      success: true,
      platform: "telegram",
      projectId: payload.projectId,
      stats,
      generatedAt: new Date().toISOString(),
    };
  }

  async getLinkedInSummary(payload: {
    projectId: string;
    ownerAddress: string;
  }): Promise<any> {
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
    ownerAddress: string;
    limit?: number;
  }): Promise<any> {
    console.log(`🐦 Getting latest tweets for project: ${payload.projectId}`);

    const tweets = await this.socialsService.getLatestTweets(
      payload.projectId,
      payload.ownerAddress,
      payload.limit || 10
    );

    return {
      success: true,
      platform: "twitter",
      projectId: payload.projectId,
      tweets,
      generatedAt: new Date().toISOString(),
    };
  }

  async getLatestLinkedInPosts(payload: {
    projectId: string;
    ownerAddress: string;
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

  // New methods for Karma integration
  async postGrantApplication(payload: {
    projectTitle: string;
    grantTitle: string;
    communityUID: string;
    karmaUID: string;
    ownerAddress: string;
  }): Promise<any> {
    const content = `🎯 Exciting news! Just submitted a grant application for "${payload.grantTitle}" for our project ${payload.projectTitle}! 

💡 Continuing to build and grow in the Web3 space. 

#Grant #Web3 #Building #${payload.communityUID}`;

    return await this.socialsService.postContent({
      projectId: payload.karmaUID,
      ownerAddress: payload.ownerAddress,
      platform: "twitter",
      content,
    });
  }

  async postMilestoneCreated(payload: {
    projectTitle: string;
    milestoneTitle: string;
    dueDate: string;
    karmaUID: string;
    ownerAddress: string;
  }): Promise<any> {
    const content = `🎯 New milestone set for ${payload.projectTitle}: "${payload.milestoneTitle}"

📅 Target date: ${payload.dueDate}

Keeping the momentum going! 🚀

#Milestone #Progress #Web3`;

    return await this.socialsService.postContent({
      projectId: payload.karmaUID,
      ownerAddress: payload.ownerAddress,
      platform: "twitter",
      content,
    });
  }

  async postMilestoneCompleted(payload: {
    projectTitle: string;
    milestoneTitle: string;
    karmaUID: string;
    grantUID: string;
    milestoneUID: string;
    ownerAddress: string;
  }): Promise<any> {
    const content = `✅ Milestone achieved! Just completed "${payload.milestoneTitle}" for ${payload.projectTitle}

Another step forward in our journey! 🎉

#MilestoneComplete #Progress #Web3 #Achievement`;

    return await this.socialsService.postContent({
      projectId: payload.karmaUID,
      ownerAddress: payload.ownerAddress,
      platform: "twitter",
      content,
    });
  }

  async stop(): Promise<void> {
    console.log("🛑 Stopping socials agent...");
    this.isListening = false;
    await this.socialsService.cleanup();
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    ownerAddress: string,
    result?: any,
    error?: string,
    characterResponse?: string
  ): Promise<void> {
    try {
      await pushLogs({
        owner_address: ownerAddress,
        project_id: workflowId,
        agent_name: this.agentName,
        text: error
          ? `Task ${taskId} failed: ${error}`
          : `Task ${taskId} completed successfully`,
        data: JSON.stringify({
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
      });
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}
