import dotenv from "dotenv";
import { ComplianceAgent } from "../agents/compliance";
import { fetchLogs } from "../services/nillion"; // Import your Nillion functions

dotenv.config();

class ComplianceServer {
  private agent: ComplianceAgent;
  private isRunning = false;
  private processedLogs: Set<string> = new Set(); // Track processed log IDs
  private lastPollTime: Date = new Date(); // Track when we last polled
  private pollInterval: number = 5000; // Poll every 5 seconds

  constructor() {
    this.agent = new ComplianceAgent();
    console.log("🤖 Compliance Agent initialized with Nillion storage");
  }

  async start() {
    console.log("🤖 Compliance Agent starting...");
    console.log(`📥 Polling Nillion logs every ${this.pollInterval}ms`);
    console.log("🔍 Looking for compliance tasks in logs...");

    this.isRunning = true;
    await this.pollNillionLogs();
  }

  async stop() {
    this.isRunning = false;
    console.log("🛑 Compliance Agent stopped");
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

      // Filter logs for compliance agent tasks
      const complianceLogs = allLogs.filter((log) => {
        // Check if this log is meant for the compliance agent
        return (
          log.agent_name === "monitoring-compliance" ||
          log.agent_name === "compliance" ||
          (log.text && log.text.toLowerCase().includes("compliance")) ||
          (log.data && this.isComplianceTask(log.data))
        );
      });

      // Process new logs (ones we haven't seen before)
      const newLogs = complianceLogs.filter(
        (log) => !this.processedLogs.has(log.id || "")
      );

      if (newLogs.length > 0) {
        console.log(`📋 Found ${newLogs.length} new compliance task(s)`);

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

  private isComplianceTask(dataString: string): boolean {
    try {
      const data = JSON.parse(dataString);

      // Check if this looks like a task meant for compliance agent
      const complianceTaskTypes = [
        "SCAN_SIMILAR_PROJECTS",
        "PROJECT_CREATED_COMPLIANCE_CHECK",
        "GET_SIMILAR_PROJECTS",
        "SEARCH_SIMILAR_PROJECTS",
        "ANALYZE_SIMILARITY",
        "REVIEW_COMPLIANCE",
      ];

      return (
        (data.type && complianceTaskTypes.includes(data.type)) ||
        data.agent === "monitoring-compliance" ||
        data.agent === "compliance" ||
        (data.payload && data.payload.agent === "compliance")
      );
    } catch {
      return false;
    }
  }

  private async processLogAsTask(log: any) {
    try {
      console.log(`📋 Processing compliance log: ${log.id}`);
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

      console.log(
        `🔒 Processing compliance task: ${task.type} (${task.taskId})`
      );

      // Process the task using the existing agent logic
      await this.agent.processTask(task);

      console.log(`✅ Compliance task completed: ${task.taskId}`);
    } catch (error) {
      console.error(`❌ Error processing compliance log ${log.id}:`, error);

      // Report the error back
      try {
        const taskId = log.id;
        const workflowId = log.project_id || "unknown-workflow";

        await this.agent.reportTaskCompletion(
          taskId,
          workflowId,
          null,
          error instanceof Error ? error.message : "Unknown error",
          "Failed to process compliance task, I have. Disappointed in myself, I am."
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
          name: "Princess Leia",
          personality: "Diplomatic yet firm in protecting your interests",
        },
      },
    };
  }

  private inferTaskTypeFromLog(log: any): string {
    const text = log.text.toLowerCase();

    if (text.includes("scan") && text.includes("similar")) {
      return "SCAN_SIMILAR_PROJECTS";
    } else if (text.includes("project") && text.includes("created")) {
      return "PROJECT_CREATED_COMPLIANCE_CHECK";
    } else if (text.includes("get") && text.includes("similar")) {
      return "GET_SIMILAR_PROJECTS";
    } else if (text.includes("search") && text.includes("similar")) {
      return "SEARCH_SIMILAR_PROJECTS";
    } else if (text.includes("analyze") && text.includes("similarity")) {
      return "ANALYZE_SIMILARITY";
    } else if (text.includes("review") && text.includes("compliance")) {
      return "REVIEW_COMPLIANCE";
    } else {
      // Default task type
      return "PROJECT_CREATED_COMPLIANCE_CHECK";
    }
  }

  // Optional: Add method to manually trigger a check (for testing)
  async checkNow(): Promise<void> {
    console.log("🔍 Manually triggering compliance check...");
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

const server = new ComplianceServer();

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
  console.error("Failed to start Compliance Agent server:", error);
  process.exit(1);
});

export { ComplianceServer };
