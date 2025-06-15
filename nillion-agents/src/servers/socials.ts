import dotenv from "dotenv";
import { SocialsAgent } from "../agents/socials";
import { fetchLogs } from "../services/nillion"; // Import your Nillion functions

dotenv.config();

class SocialsServer {
  private agent: SocialsAgent;
  private isRunning = false;
  private processedLogs: Set<string> = new Set(); // Track processed log IDs
  private lastPollTime: Date = new Date(); // Track when we last polled
  private pollInterval: number = 5000; // Poll every 5 seconds

  constructor() {
    this.agent = new SocialsAgent();
    console.log("🤖 Socials Agent initialized with Nillion storage");
  }

  async start() {
    console.log("🤖 Socials Agent starting...");
    console.log(`📥 Polling Nillion logs every ${this.pollInterval}ms`);
    console.log("🔍 Looking for socials tasks in logs...");

    this.isRunning = true;
    await this.pollNillionLogs();
  }

  async stop() {
    this.isRunning = false;
    console.log("🛑 Socials Agent stopped");
  }

  private async pollNillionLogs() {
    while (this.isRunning) {
      try {
        await this.checkForNewTasks();
        await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      } catch (error) {
        console.error("❌ Error polling Nillion logs:", error);
        // Wait a bit longer on error before retrying
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
  }

  private async checkForNewTasks() {
    try {
      // Fetch all logs from Nillion
      const allLogs = await fetchLogs();

      // Filter logs for socials agent tasks
      const socialsLogs = allLogs.filter((log) => {
        // Check if this log is meant for the socials agent
        return (
          log.agent_name === "social-media" ||
          log.agent_name === "socials" ||
          (log.text && log.text.toLowerCase().includes("social")) ||
          (log.text && log.text.toLowerCase().includes("twitter")) ||
          (log.text && log.text.toLowerCase().includes("linkedin")) ||
          (log.text && log.text.toLowerCase().includes("telegram")) ||
          (log.text && log.text.toLowerCase().includes("post")) ||
          (log.text && log.text.toLowerCase().includes("tweet")) ||
          (log.data && this.isSocialsTask(log.data))
        );
      });

      // Process new logs (ones we haven't seen before)
      const newLogs = socialsLogs.filter(
        (log) => !this.processedLogs.has(log._id || "")
      );

      if (newLogs.length > 0) {
        console.log(`📋 Found ${newLogs.length} new socials task(s)`);

        for (const log of newLogs) {
          await this.processLogAsTask(log);
          // Mark this log as processed
          this.processedLogs.add(log._id || "");
        }
      }

      // Clean up old processed log IDs to prevent memory bloat
      // Keep only the last 1000 processed logs
      if (this.processedLogs.size > 1000) {
        const logsArray = Array.from(this.processedLogs);
        this.processedLogs.clear();
        // Keep the last 500
        logsArray.slice(-500).forEach((id) => this.processedLogs.add(id));
      }
    } catch (error) {
      console.error("❌ Error checking for new tasks:", error);
      throw error;
    }
  }

  private isSocialsTask(dataString: string): boolean {
    try {
      const data = JSON.parse(dataString);

      // Check if this looks like a task meant for socials agent
      const socialsTaskTypes = [
        "SETUP_SOCIAL",
        "TWEET_ABOUT",
        "POST_MILESTONE_CREATED",
        "POST_MILESTONE_COMPLETED",
        "MODIFY_CHARACTER",
        "SET_FREQUENCY",
        "CHANGE_ACCOUNTS",
        "GET_SOCIAL_SUMMARY",
        "GET_X_SUMMARY",
        "GET_TELEGRAM_SUMMARY",
        "GET_LINKEDIN_SUMMARY",
        "GET_LATEST_TWEETS",
        "GET_LATEST_LINKEDIN_POSTS",
        "SCHEDULE_POST",
        "AUTO_POST_UPDATE",
      ];

      return (
        (data.type && socialsTaskTypes.includes(data.type)) ||
        data.agent === "social-media" ||
        data.agent === "socials" ||
        (data.payload && data.payload.agent === "socials") ||
        (data.payload && data.payload.socials) ||
        (data.payload && data.payload.platforms)
      );
    } catch {
      return false;
    }
  }

  private async processLogAsTask(log: any) {
    try {
      console.log(`📋 Processing socials log: ${log._id}`);
      console.log(`📝 Log text: ${log.text}`);

      let task;

      // Try to parse the task from the data field
      try {
        task = JSON.parse(log.data);
      } catch (parseError) {
        // If data field isn't a valid task, create a task from the log info
        console.log(
          "⚠️ Could not parse log data as task, creating task from log info"
        );
        task = this.createTaskFromLog(log);
      }

      // Ensure task has required fields
      if (!task.taskId) {
        task.taskId = log._id; // Use log ID as task ID
      }

      if (!task.workflowId) {
        task.workflowId = log.project_id || "unknown-workflow";
      }

      if (!task.type) {
        // Try to infer task type from log text or default
        task.type = this.inferTaskTypeFromLog(log);
      }

      console.log(`📱 Processing socials task: ${task.type} (${task.taskId})`);

      // Process the task using the existing agent logic
      await this.agent.processTask(task);

      console.log(`✅ Socials task completed: ${task.taskId}`);
    } catch (error) {
      console.error(`❌ Error processing socials log ${log._id}:`, error);

      // Report the error back
      try {
        const taskId = log._id;
        const workflowId = log.project_id || "unknown-workflow";

        await this.agent.reportTaskCompletion(
          taskId,
          workflowId,
          log.owner_address,
          error instanceof Error ? error.message : "Unknown error",
          "Failed to dominate the social channels, I have. The Empire demands better results!"
        );
      } catch (reportError) {
        console.error(
          "❌ Failed to report task completion error:",
          reportError
        );
      }
    }
  }

  private createTaskFromLog(log: any): any {
    return {
      taskId: log._id,
      workflowId: log.project_id || "unknown-workflow",
      type: this.inferTaskTypeFromLog(log),
      payload: {
        projectId: log.project_id,
        ownerAddress: log.owner_address,
        logText: log.text,
        // Add any other relevant info from the log
      },
      priority: "MEDIUM",
      characterInfo: {
        side: "light", // Default to light side
        agentCharacter: {
          name: "Ahsoka Tano",
          personality:
            "Bold and spirited in social engagement, I am. Connect with communities and spread your message, I will.",
        },
      },
    };
  }

  private inferTaskTypeFromLog(log: any): string {
    const text = log.text.toLowerCase();

    if (text.includes("setup") && text.includes("social")) {
      return "SETUP_SOCIAL";
    } else if (text.includes("tweet") && text.includes("about")) {
      return "TWEET_ABOUT";
    } else if (
      text.includes("post") &&
      text.includes("milestone") &&
      text.includes("created")
    ) {
      return "POST_MILESTONE_CREATED";
    } else if (
      text.includes("post") &&
      text.includes("milestone") &&
      text.includes("completed")
    ) {
      return "POST_MILESTONE_COMPLETED";
    } else if (text.includes("modify") && text.includes("character")) {
      return "MODIFY_CHARACTER";
    } else if (text.includes("set") && text.includes("frequency")) {
      return "SET_FREQUENCY";
    } else if (text.includes("change") && text.includes("accounts")) {
      return "CHANGE_ACCOUNTS";
    } else if (
      text.includes("get") &&
      text.includes("social") &&
      text.includes("summary")
    ) {
      return "GET_SOCIAL_SUMMARY";
    } else if (
      text.includes("get") &&
      text.includes("x") &&
      text.includes("summary")
    ) {
      return "GET_X_SUMMARY";
    } else if (
      text.includes("get") &&
      text.includes("telegram") &&
      text.includes("summary")
    ) {
      return "GET_TELEGRAM_SUMMARY";
    } else if (
      text.includes("get") &&
      text.includes("linkedin") &&
      text.includes("summary")
    ) {
      return "GET_LINKEDIN_SUMMARY";
    } else if (
      text.includes("get") &&
      text.includes("latest") &&
      text.includes("tweets")
    ) {
      return "GET_LATEST_TWEETS";
    } else if (
      text.includes("get") &&
      text.includes("linkedin") &&
      text.includes("posts")
    ) {
      return "GET_LATEST_LINKEDIN_POSTS";
    } else if (text.includes("schedule") && text.includes("post")) {
      return "SCHEDULE_POST";
    } else if (text.includes("auto") && text.includes("post")) {
      return "AUTO_POST_UPDATE";
    } else {
      // Default task type
      return "SETUP_SOCIAL";
    }
  }

  // Optional: Add method to manually trigger a check (for testing)
  async checkNow(): Promise<void> {
    console.log("🔍 Manually triggering socials check...");
    await this.checkForNewTasks();
  }

  // Optional: Get status information
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      processedLogsCount: this.processedLogs.size,
      pollInterval: this.pollInterval,
      lastPollTime: this.lastPollTime,
    };
  }

  // Optional: Set poll interval
  setPollInterval(intervalMs: number): void {
    this.pollInterval = intervalMs;
    console.log(`📅 Poll interval updated to ${intervalMs}ms`);
  }
}

const server = new SocialsServer();

// Graceful shutdown handling
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  await server.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  await server.stop();
  process.exit(0);
});

server.start().catch((error) => {
  console.error("Failed to start Socials Agent server:", error);
  process.exit(1);
});

export { SocialsServer };
