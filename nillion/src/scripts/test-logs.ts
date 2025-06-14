import dotenv from "dotenv";
dotenv.config();

import { ServiceFactory } from "../services";

async function testLogs() {
  console.log("🧪 Testing Logs Service...\n");

  const logsService = ServiceFactory.getLogs();

  try {
    // Create test logs
    console.log("📝 Creating test logs...");
    const projectId = "test-project-123";

    const logId1 = await logsService.createLog(
      projectId,
      "github",
      "Successfully analyzed repository structure",
      {
        repoUrl: "https://github.com/test/repo",
        fileCount: 42,
        language: "TypeScript",
      }
    );

    const logId2 = await logsService.createLog(
      projectId,
      "leads",
      "Identified 5 potential leads from social media",
      {
        platform: "twitter",
        leads: ["@user1", "@user2", "@user3"],
        sentiment: "positive",
      }
    );

    const logId3 = await logsService.createLog(
      projectId,
      "orchestrator",
      "Coordinating next steps between agents",
      { nextActions: ["analyze_code", "contact_leads"], priority: "high" }
    );

    console.log(`✅ Created logs: ${logId1}, ${logId2}, ${logId3}\n`);

    // Read logs
    console.log("📖 Reading logs...");
    const allLogs = await logsService.findAll();
    console.log(`📊 Total logs: ${allLogs.length}`);

    const projectLogs = await logsService.getLogsByProject(projectId);
    console.log(`📋 Project logs: ${projectLogs.length}`);

    const githubLogs = await logsService.getLogsByAgent("github");
    console.log(`🐙 GitHub agent logs: ${githubLogs.length}`);

    // Display sample log
    if (projectLogs.length > 0) {
      console.log("\n📄 Sample log:");
      const log = projectLogs[0];
      console.log(`  Agent: ${log.agentName}`);
      console.log(`  Text: ${log.text}`);
      console.log(`  Data: ${JSON.stringify(log.data, null, 2)}`);
    }

    console.log("\n✅ Logs service test completed successfully!");
  } catch (error) {
    console.error("❌ Logs service test failed:", error);
    process.exit(1);
  }
}

testLogs();
