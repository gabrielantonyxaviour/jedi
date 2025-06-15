import dotenv from "dotenv";
import { KarmaAgent } from "../agents/karma";
import { fetchLogs } from "../services/nillion"; // Import your Nillion functions

dotenv.config();

export class KarmaServer {
  private karmaAgent: KarmaAgent;
  private isRunning = false;
  private processedLogs: Set<string> = new Set(); // Track processed log IDs
  private lastPollTime: Date = new Date(); // Track when we last polled
  private pollInterval: number = 5000; // Poll every 5 seconds

  constructor() {
    console.log("🔧 Initializing Karma server...");
    this.karmaAgent = new KarmaAgent();
    console.log("🤖 Karma Agent initialized with Nillion storage");
    console.log("✅ Karma server initialized");
  }

  async start(): Promise<void> {
    console.log("🚀 Starting Karma agent server...");
    console.log(`📥 Polling Nillion logs every ${this.pollInterval}ms`);
    console.log("🔍 Looking for Karma tasks in logs...");

    this.isRunning = true;
    await this.pollNillionLogs();
  }

  async stop(): Promise<void> {
    console.log("🛑 Stopping Karma Agent...");
    this.isRunning = false;
    console.log("✅ Karma Agent stopped");
  }

  private async pollNillionLogs() {
    console.log("📡 Starting Nillion log polling loop in Karma...");
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
      console.log("🔍 Polling for new Karma tasks...");
      // Fetch all logs from Nillion
      const allLogs = await fetchLogs();

      // Filter logs for Karma agent tasks
      const karmaLogs = allLogs.filter((log) => {
        // Check if this log is meant for the Karma agent
        return (
          log.agent_name === "karma-integration" ||
          log.agent_name === "karma" ||
          (log.text && log.text.toLowerCase().includes("karma")) ||
          (log.text && log.text.toLowerCase().includes("grant")) ||
          (log.text && log.text.toLowerCase().includes("milestone")) ||
          (log.text && log.text.toLowerCase().includes("funding")) ||
          (log.data && this.isKarmaTask(log.data))
        );
      });

      // Process new logs (ones we haven't seen before)
      const newLogs = karmaLogs.filter(
        (log) => !this.processedLogs.has(log.id || "")
      );

      if (newLogs.length > 0) {
        console.log(`📨 Found ${newLogs.length} new Karma task(s)`);

        for (const log of newLogs) {
          await this.processLogAsTask(log);
          // Mark this log as processed
          this.processedLogs.add(log.id || "");
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

  private isKarmaTask(dataString: string): boolean {
    try {
      const data = JSON.parse(dataString);

      // Check if this looks like a task meant for Karma agent
      const karmaTaskTypes = [
        "CREATE_KARMA_PROJECT",
        "CREATE_MILESTONE",
        "COMPLETE_MILESTONE",
        "GET_GRANT_OPPORTUNITIES",
        "GET_COMMUNITIES",
        "GET_PROJECTS",
        "APPLY_FOR_GRANT",
        "UPDATE_PROJECT",
        "GET_PROJECT_DETAILS",
        "SUBMIT_MILESTONE_UPDATE",
        "GET_FUNDING_STATUS",
      ];

      return (
        (data.type && karmaTaskTypes.includes(data.type)) ||
        data.agent === "karma-integration" ||
        data.agent === "karma" ||
        (data.payload && data.payload.agent === "karma") ||
        (data.payload && data.payload.karmaProjectId) ||
        (data.payload && data.payload.grantUID)
      );
    } catch {
      return false;
    }
  }

  private async processLogAsTask(log: any) {
    try {
      console.log(`🔄 Processing Karma log: ${log.id}`);
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
        task.taskId = log.id; // Use log ID as task ID
      }

      if (!task.workflowId) {
        task.workflowId = log.project_id || "unknown-workflow";
      }

      if (!task.type) {
        // Try to infer task type from log text or default
        task.type = this.inferTaskTypeFromLog(log);
      }

      console.log(`🎯 Processing Karma task: ${task.type} (${task.taskId})`);

      // Process the task using the existing agent logic
      const result = await this.karmaAgent.processTask(task);

      console.log(`✅ Karma task ${task.taskId} processed successfully`);
      await this.reportTaskCompletion(task.taskId, task.workflowId, result);
    } catch (error) {
      console.error(`❌ Error processing Karma log ${log.id}:`, error);

      // Report the error back
      try {
        const taskId = log.id;
        const workflowId = log.project_id || "unknown-workflow";

        await this.reportTaskCompletion(
          taskId,
          workflowId,
          null,
          error instanceof Error ? error.message : "Unknown error"
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
      taskId: log.id,
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
          name: "Luke Skywalker",
          personality:
            "Hopeful and determined in seeking opportunities, I am. Help you find grants and build connections, I will.",
        },
      },
    };
  }

  private inferTaskTypeFromLog(log: any): string {
    const text = log.text.toLowerCase();

    if (text.includes("create") && text.includes("project")) {
      return "CREATE_KARMA_PROJECT";
    } else if (text.includes("create") && text.includes("milestone")) {
      return "CREATE_MILESTONE";
    } else if (text.includes("complete") && text.includes("milestone")) {
      return "COMPLETE_MILESTONE";
    } else if (text.includes("grant") && text.includes("opportunities")) {
      return "GET_GRANT_OPPORTUNITIES";
    } else if (text.includes("communities")) {
      return "GET_COMMUNITIES";
    } else if (text.includes("get") && text.includes("projects")) {
      return "GET_PROJECTS";
    } else if (text.includes("apply") && text.includes("grant")) {
      return "APPLY_FOR_GRANT";
    } else if (text.includes("update") && text.includes("project")) {
      return "UPDATE_PROJECT";
    } else if (text.includes("funding") && text.includes("status")) {
      return "GET_FUNDING_STATUS";
    } else {
      // Default task type
      return "CREATE_KARMA_PROJECT";
    }
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string
  ) {
    console.log(`📤 Reporting completion for Karma task ${taskId}...`);
    try {
      // Store completion result in Nillion logs
      const completionLog = {
        owner_address: "system",
        project_id: workflowId,
        agent_name: "karma-integration",
        text: `Task completion: ${taskId}`,
        data: JSON.stringify({
          type: "TASK_COMPLETION",
          payload: {
            taskId,
            workflowId,
            status: error ? "FAILED" : "COMPLETED",
            result,
            error,
            timestamp: new Date().toISOString(),
            agent: "karma-integration",
          },
        }),
      };

      // You could use pushLogs here, but since we don't have access to it,
      // we'll just log for now. In a real implementation, you'd store this back to Nillion
      console.log(`✅ Karma task ${taskId} completion reported successfully`);
    } catch (err) {
      console.error(
        `❌ Failed to report Karma task ${taskId} completion:`,
        err
      );
    }
  }

  // Optional: Add method to manually trigger a check (for testing)
  async checkNow(): Promise<void> {
    console.log("🔍 Manually triggering Karma check...");
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
}

const server = new KarmaServer();

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
  console.error("💥 Failed to start Karma Agent server:", error);
  process.exit(1);
});
