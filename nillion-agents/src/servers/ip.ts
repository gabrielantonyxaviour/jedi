import dotenv from "dotenv";
import { IPAgent } from "../agents/ip";
import { fetchLogs } from "../services/nillion"; // Import your Nillion functions

dotenv.config();

class IPServer {
  private agent: IPAgent;
  private isRunning = false;
  private processedLogs: Set<string> = new Set(); // Track processed log IDs
  private lastPollTime: Date = new Date(); // Track when we last polled
  private pollInterval: number = 5000; // Poll every 5 seconds

  constructor() {
    console.log("🔧 Initializing IP Server...");
    this.agent = new IPAgent();
    console.log("🤖 IP Agent initialized with Nillion storage");
    console.log("✅ IP Server initialized");
  }

  async start() {
    console.log("🤖 IP Agent starting...");
    console.log(`📥 Polling Nillion logs every ${this.pollInterval}ms`);
    console.log("🔍 Looking for IP tasks in logs...");

    this.isRunning = true;
    await this.pollNillionLogs();
  }

  async stop() {
    console.log("🛑 Stopping IP Agent...");
    this.isRunning = false;
    console.log("✅ IP Agent stopped");
  }

  private async pollNillionLogs() {
    console.log("🔄 Starting Nillion log polling loop");
    while (this.isRunning) {
      try {
        await this.checkForNewTasks();
        await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      } catch (error) {
        console.error("❌ Error polling Nillion logs:", error);
        console.log("⏳ Waiting 10 seconds before retrying...");
        // Wait a bit longer on error before retrying
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
  }

  private async checkForNewTasks() {
    try {
      console.log("📡 Polling for new IP tasks...");
      // Fetch all logs from Nillion
      const allLogs = await fetchLogs();

      // Filter logs for IP agent tasks
      const ipLogs = allLogs.filter((log) => {
        // Check if this log is meant for the IP agent
        return (
          log.agent_name === "blockchain-ip" ||
          log.agent_name === "story-protocol-ip" ||
          log.agent_name === "ip" ||
          (log.text && log.text.toLowerCase().includes("ip")) ||
          (log.text &&
            log.text.toLowerCase().includes("intellectual property")) ||
          (log.text && log.text.toLowerCase().includes("story protocol")) ||
          (log.text && log.text.toLowerCase().includes("blockchain")) ||
          (log.text && log.text.toLowerCase().includes("register")) ||
          (log.data && this.isIPTask(log.data))
        );
      });

      // Process new logs (ones we haven't seen before)
      const newLogs = ipLogs.filter(
        (log) => !this.processedLogs.has(log._id || "")
      );

      if (newLogs.length > 0) {
        console.log(`📋 Found ${newLogs.length} new IP task(s)`);

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

  private isIPTask(dataString: string): boolean {
    try {
      const data = JSON.parse(dataString);

      // Check if this looks like a task meant for IP agent
      const ipTaskTypes = [
        "REGISTER_GITHUB_PROJECT",
        "REGISTER_IP_ASSET",
        "CREATE_DISPUTE",
        "PAY_ROYALTY",
        "CLAIM_ALL_ROYALTIES",
        "SETUP_IP_PROTECTION",
        "MONITOR_IP_USAGE",
        "UPDATE_LICENSE_TERMS",
        "CREATE_LICENSE",
        "TRANSFER_IP_OWNERSHIP",
        "MINT_IP_NFT",
        "REGISTER_STORY_PROTOCOL",
        "CREATE_IP_COLLECTION",
      ];

      return (
        (data.type && ipTaskTypes.includes(data.type)) ||
        data.agent === "blockchain-ip" ||
        data.agent === "story-protocol-ip" ||
        data.agent === "ip" ||
        (data.payload && data.payload.agent === "ip") ||
        (data.payload && data.payload.repositoryUrl) ||
        (data.payload && data.payload.license) ||
        (data.payload && data.payload.licenseTermsData)
      );
    } catch {
      return false;
    }
  }

  private async processLogAsTask(log: any) {
    try {
      console.log(`📋 Processing IP log: ${log._id}`);
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

      // Validate required fields
      if (!task.type || !task.taskId || !task.payload) {
        throw new Error("Missing required task fields");
      }

      // Set defaults for missing values
      const finalPayload = {
        ...task.payload,
        license: task.payload.license || "MIT",
        licenseTermsData: task.payload.licenseTermsData || [],
      };

      console.log(`🔒 Processing IP task: ${task.type} (${task.taskId})`);
      console.log(`📦 Task payload:`, JSON.stringify(finalPayload, null, 2));

      // Process the task using the existing agent logic
      await this.agent.processTask({
        ...task,
        payload: finalPayload,
      });

      console.log(`✅ IP task completed: ${task.taskId}`);
    } catch (error) {
      console.error(`❌ Error processing IP log ${log._id}:`, error);
      console.error("📄 Log content:", JSON.stringify(log, null, 2));

      // Report the error back
      try {
        const taskId = log._id;
        const workflowId = log.project_id || "unknown-workflow";

        await this.agent.reportTaskCompletion(
          taskId,
          workflowId,
          log.owner_address,
          error instanceof Error ? error.message : "Unknown error",
          "Failed to process IP task, I have. The dark side of intellectual property, clouded it is."
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
        license: "MIT", // Default license
        licenseTermsData: [], // Default empty license terms
        // Add any other relevant info from the log
      },
      priority: "HIGH", // IP tasks are typically high priority
      characterInfo: {
        side: "light", // Default to light side
        agentCharacter: {
          name: "Obi-Wan Kenobi",
          personality:
            "Wise and measured in protecting intellectual property, I am. Guide you through the complexities of IP law, I will.",
        },
      },
    };
  }

  private inferTaskTypeFromLog(log: any): string {
    const text = log.text.toLowerCase();

    if (
      text.includes("register") &&
      (text.includes("github") || text.includes("project"))
    ) {
      return "REGISTER_GITHUB_PROJECT";
    } else if (text.includes("register") && text.includes("ip")) {
      return "REGISTER_IP_ASSET";
    } else if (text.includes("create") && text.includes("dispute")) {
      return "CREATE_DISPUTE";
    } else if (text.includes("pay") && text.includes("royalty")) {
      return "PAY_ROYALTY";
    } else if (text.includes("claim") && text.includes("royalties")) {
      return "CLAIM_ALL_ROYALTIES";
    } else if (text.includes("setup") && text.includes("protection")) {
      return "SETUP_IP_PROTECTION";
    } else if (text.includes("monitor") && text.includes("usage")) {
      return "MONITOR_IP_USAGE";
    } else if (text.includes("update") && text.includes("license")) {
      return "UPDATE_LICENSE_TERMS";
    } else if (text.includes("create") && text.includes("license")) {
      return "CREATE_LICENSE";
    } else if (text.includes("transfer") && text.includes("ownership")) {
      return "TRANSFER_IP_OWNERSHIP";
    } else if (text.includes("mint") && text.includes("nft")) {
      return "MINT_IP_NFT";
    } else if (text.includes("story") && text.includes("protocol")) {
      return "REGISTER_STORY_PROTOCOL";
    } else if (text.includes("collection")) {
      return "CREATE_IP_COLLECTION";
    } else {
      // Default task type
      return "REGISTER_GITHUB_PROJECT";
    }
  }

  // Optional: Add method to manually trigger a check (for testing)
  async checkNow(): Promise<void> {
    console.log("🔍 Manually triggering IP check...");
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

console.log("🚀 Starting IP Server...");
const server = new IPServer();

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
  console.error("💥 Failed to start IP Agent server:", error);
  process.exit(1);
});

export { IPServer };
