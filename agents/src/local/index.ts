// src/local/index.ts
import axios from "axios";

const BASE_URL = "http://localhost:3000";

async function testServer() {
  console.log("🧪 Testing server endpoints...\n");

  try {
    // Test analysis endpoint
    console.log("1. Testing analysis endpoint...");
    const analysisResponse = await axios.post(`${BASE_URL}/api/analyze`, {
      repoUrl: "https://github.com/gabrielantonyxaviour/franky-agent-router",
    });

    console.log("✅ Analysis successful:", analysisResponse.data.message);
    console.log("📡 Webhook registered:", analysisResponse.data.webhookUrl);

    // Test get project data
    console.log("\n2. Testing get project data...");
    const projectResponse = await axios.get(
      `${BASE_URL}/api/project/gabrielantonyxaviour/franky-agent-router`
    );

    console.log("✅ Project data retrieved");
    console.log(
      "📊 Project name:",
      projectResponse.data.analysis.metadata.name
    );

    console.log("\n🎉 All tests passed!");
    console.log(
      "\n🔥 Now make a commit to your repo and watch the webhook in action!"
    );
  } catch (error: any) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

testServer();
