import dotenv from "dotenv";
import { LeadsAgent } from "../agents/leads";
import { fetchLogs } from "../services/nillion"; // Import your Nillion functions

dotenv.config();

class LeadsServer {
  private agent: LeadsAgent;
  private isRunning = false;
  private processedLogs: Set<string> = new Set(); // Track processed log IDs
  private lastPollTime: Date = new Date(); // Track when we last polled
  private pollInterval: number = 5000; // Poll every 5 seconds

  constructor() {
    this.agent = new LeadsAgent();
    console.log("🤖 Leads Agent initialized with Nillion storage");
  }

  async start() {
    console.log("🤖 Leads Agent starting...");
    console.log(`📥 Polling Nillion logs every ${this.pollInterval}ms`);
    console.log("🔍 Looking for leads tasks in logs...");

    this.isRunning = true;
    await this.pollNillionLogs();
  }

  async stop() {
    this.isRunning = false;
    console.log("🛑 Leads Agent stopped");
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

      // Filter logs for leads agent tasks
      const leadsLogs = allLogs.filter((log) => {
        // Check if this log is meant for the leads agent
        return (
          log.agent_name === "lead-generation" ||
          log.agent_name === "leads" ||
          (log.text && log.text.toLowerCase().includes("leads")) ||
          (log.text && log.text.toLowerCase().includes("lead generation")) ||
          (log.text && log.text.toLowerCase().includes("prospects")) ||
          (log.text && log.text.toLowerCase().includes("contacts")) ||
          (log.data && this.isLeadsTask(log.data))
        );
      });

      // Process new logs (ones we haven't seen before)
      const newLogs = leadsLogs.filter(
        (log) => !this.processedLogs.has(log.id || "")
      );

      if (newLogs.length > 0) {
        console.log(`📋 Found ${newLogs.length} new leads task(s)`);

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

  private isLeadsTask(dataString: string): boolean {
    try {
      const data = JSON.parse(dataString);

      // Check if this looks like a task meant for leads agent
      const leadsTaskTypes = [
        "PROJECT_CREATED_LEADS_SEARCH",
        "GENERATE_LEADS",
        "SEARCH_LEADS",
        "GET_LATEST_LEADS",
        "GET_LEADS_BY_SOURCE",
        "QUALIFY_LEADS",
        "UPDATE_LEAD_STATUS",
        "EXPORT_LEADS",
        "SCAN_SOCIAL_MEDIA",
        "FIND_CONTACTS",
        "RESEARCH_COMPANIES",
      ];

      return (
        (data.type && leadsTaskTypes.includes(data.type)) ||
        data.agent === "lead-generation" ||
        data.agent === "leads" ||
        (data.payload && data.payload.agent === "leads") ||
        (data.payload && data.payload.sources) ||
        (data.payload && data.payload.keywords)
      );
    } catch {
      return false;
    }
  }

  private async processLogAsTask(log: any) {
    try {
      console.log(`📋 Processing leads log: ${log.id}`);
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

      console.log(`🎯 Processing leads task: ${task.type} (${task.taskId})`);

      // Process the task using the existing agent logic
      await this.agent.processTask(task);

      console.log(`✅ Leads task completed: ${task.taskId}`);
    } catch (error) {
      console.error(`❌ Error processing leads log ${log.id}:`, error);

      // Report the error back
      try {
        const taskId = log.id;
        const workflowId = log.project_id || "unknown-workflow";

        await this.agent.reportTaskCompletion(
          taskId,
          workflowId,
          log.owner_address,
          error instanceof Error ? error.message : "Unknown error",
          "*Wookiee growls of frustration* Failed to hunt opportunities, I have. Try again, I must."
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
        sources: ["all"],
        maxResults: 50,
        // Add any other relevant info from the log
      },
      priority: "MEDIUM",
      characterInfo: {
        side: "light", // Default to light side
        agentCharacter: {
          name: "Chewbacca",
          personality:
            "Loyal and fierce in hunting opportunities, I am. Find great leads for your project, I will.",
        },
      },
    };
  }

  private inferTaskTypeFromLog(log: any): string {
    const text = log.text.toLowerCase();

    if (
      text.includes("project") &&
      text.includes("created") &&
      text.includes("leads")
    ) {
      return "PROJECT_CREATED_LEADS_SEARCH";
    } else if (text.includes("generate") && text.includes("leads")) {
      return "GENERATE_LEADS";
    } else if (text.includes("search") && text.includes("leads")) {
      return "SEARCH_LEADS";
    } else if (
      text.includes("get") &&
      text.includes("latest") &&
      text.includes("leads")
    ) {
      return "GET_LATEST_LEADS";
    } else if (
      text.includes("get") &&
      text.includes("leads") &&
      text.includes("source")
    ) {
      return "GET_LEADS_BY_SOURCE";
    } else if (text.includes("qualify") && text.includes("leads")) {
      return "QUALIFY_LEADS";
    } else if (text.includes("update") && text.includes("lead")) {
      return "UPDATE_LEAD_STATUS";
    } else if (text.includes("export") && text.includes("leads")) {
      return "EXPORT_LEADS";
    } else if (text.includes("scan") && text.includes("social")) {
      return "SCAN_SOCIAL_MEDIA";
    } else if (text.includes("find") && text.includes("contacts")) {
      return "FIND_CONTACTS";
    } else if (text.includes("research") && text.includes("companies")) {
      return "RESEARCH_COMPANIES";
    } else {
      // Default task type
      return "PROJECT_CREATED_LEADS_SEARCH";
    }
  }

  // Optional: Add method to manually trigger a check (for testing)
  async checkNow(): Promise<void> {
    console.log("🔍 Manually triggering leads check...");
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

const server = new LeadsServer();

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
  console.error("Failed to start Leads Agent server:", error);
  process.exit(1);
});

export { LeadsServer };
