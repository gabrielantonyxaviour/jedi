import dotenv from "dotenv";
import { GitHubIntelligenceAgent } from "../agents/github";
import { fetchLogs } from "../services/nillion"; // Import your Nillion functions

dotenv.config();

class GitHubAgentServer {
  private agent: GitHubIntelligenceAgent;
  private isRunning = false;
  private processedLogs: Set<string> = new Set(); // Track processed log IDs
  private lastPollTime: Date = new Date(); // Track when we last polled
  private pollInterval: number = 5000; // Poll every 5 seconds

  constructor() {
    this.agent = new GitHubIntelligenceAgent();
    console.log(
      "🤖 GitHub Intelligence Agent initialized with Nillion storage"
    );
  }

  async start() {
    console.log("🤖 GitHub Intelligence Agent starting...");
    console.log(`📥 Polling Nillion logs every ${this.pollInterval}ms`);
    console.log("🔍 Looking for GitHub tasks in logs...");

    this.isRunning = true;
    await this.pollNillionLogs();
  }

  async stop() {
    this.isRunning = false;
    console.log("🛑 GitHub Intelligence Agent stopped");
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

      // Filter logs for GitHub agent tasks
      const githubLogs = allLogs.filter((log) => {
        // Check if this log is meant for the GitHub agent
        return (
          log.agent_name === "github-intelligence" ||
          log.agent_name === "github"
        );
      });

      console.log("🔍 GitHub logs:", githubLogs);

      // Process new logs (ones we haven't seen before)
      const newLogs = githubLogs.filter(
        (log) => !this.processedLogs.has(log.id || "")
      );

      if (newLogs.length > 0) {
        console.log(`📋 Found ${newLogs.length} new GitHub task(s)`);

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

  private isGithubTask(dataString: string): boolean {
    try {
      const data = JSON.parse(dataString);

      // Check if this looks like a task meant for GitHub agent
      const githubTaskTypes = [
        "ANALYZE_REPOSITORY",
        "ANALYZE_AND_SETUP_PROJECT",
        "PROCESS_WEBHOOK",
        "FETCH_REPO_INFO",
        "GET_LATEST_COMMITS",
        "FETCH_IMPORTANT_FILES",
        "UPDATE_IMPORTANT_FILES",
        "SCAN_REPOSITORIES",
        "MONITOR_REPO_CHANGES",
        "GET_GITHUB_DATA",
        "UPDATE_GITHUB_DATA",
      ];

      return (
        (data.type && githubTaskTypes.includes(data.type)) ||
        data.agent === "github-intelligence" ||
        data.agent === "github" ||
        (data.payload && data.payload.agent === "github") ||
        (data.payload && data.payload.repoUrl) ||
        (data.payload && data.payload.repositoryUrl)
      );
    } catch {
      return false;
    }
  }

  private async processLogAsTask(log: any) {
    try {
      console.log(`📋 Processing GitHub log: ${log.id}`);
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

      console.log(`🔧 Processing GitHub task: ${task.type} (${task.taskId})`);

      // Process the task using the existing agent logic
      const result = await this.agent.processTask(task);

      console.log(`✅ GitHub task completed: ${task.taskId}`);
    } catch (error) {
      console.error(`❌ Error processing GitHub log ${log.id}:`, error);

      // Report the error back
      try {
        const taskId = log.id;
        const workflowId = log.project_id || "unknown-workflow";

        await this.agent.reportTaskCompletion(
          taskId,
          workflowId,
          log.owner_address,
          error instanceof Error ? error.message : "Unknown error",
          "Failed to process GitHub task, I have. Calculate the odds of success again, I must."
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
          name: "C-3PO",
          personality:
            "Protocol and precision, my specialties they are. Helpful with repository management, I shall be.",
        },
      },
    };
  }

  private inferTaskTypeFromLog(log: any): string {
    const text = log.text.toLowerCase();

    if (
      text.includes("analyze") &&
      (text.includes("repository") || text.includes("repo"))
    ) {
      return "ANALYZE_REPOSITORY";
    } else if (
      text.includes("analyze") &&
      text.includes("setup") &&
      text.includes("project")
    ) {
      return "ANALYZE_AND_SETUP_PROJECT";
    } else if (text.includes("webhook") || text.includes("hook")) {
      return "PROCESS_WEBHOOK";
    } else if (text.includes("fetch") && text.includes("repo")) {
      return "FETCH_REPO_INFO";
    } else if (text.includes("commits") || text.includes("commit")) {
      return "GET_LATEST_COMMITS";
    } else if (text.includes("fetch") && text.includes("files")) {
      return "FETCH_IMPORTANT_FILES";
    } else if (text.includes("update") && text.includes("files")) {
      return "UPDATE_IMPORTANT_FILES";
    } else if (text.includes("scan") && text.includes("repositories")) {
      return "SCAN_REPOSITORIES";
    } else if (text.includes("monitor") && text.includes("changes")) {
      return "MONITOR_REPO_CHANGES";
    } else if (
      text.includes("get") &&
      text.includes("github") &&
      text.includes("data")
    ) {
      return "GET_GITHUB_DATA";
    } else if (
      text.includes("update") &&
      text.includes("github") &&
      text.includes("data")
    ) {
      return "UPDATE_GITHUB_DATA";
    } else {
      // Default task type
      return "ANALYZE_REPOSITORY";
    }
  }

  // Optional: Add method to manually trigger a check (for testing)
  async checkNow(): Promise<void> {
    console.log("🔍 Manually triggering GitHub check...");
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

const server = new GitHubAgentServer();

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
  console.error("Failed to start GitHub Intelligence Agent server:", error);
  process.exit(1);
});

export { GitHubAgentServer };
