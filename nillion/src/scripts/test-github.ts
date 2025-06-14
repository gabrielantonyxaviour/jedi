import dotenv from "dotenv";
dotenv.config();

import { ServiceFactory } from "../services/index.js";

async function testGithub() {
  console.log("🧪 Testing GitHub Service...\n");

  const githubService = ServiceFactory.getGithub();

  try {
    // Create test projects
    console.log("📝 Creating test GitHub projects...");

    const projectId1 = await githubService.createProject(
      "AI Chat Assistant",
      "An intelligent chat assistant built with TypeScript and React",
      "Uses OpenAI GPT-4, implements RAG with vector database, TypeScript backend with Express",
      "https://github.com/user/ai-chat-assistant",
      "john_doe",
      ["jane_smith", "bob_wilson"],
      {
        language: "TypeScript",
        framework: "React",
        stars: 234,
        lastCommit: "2024-06-14",
        topics: ["ai", "chat", "typescript", "react"],
      }
    );

    const projectId2 = await githubService.createProject(
      "Blockchain Voting System",
      "Decentralized voting platform on Ethereum",
      "Smart contracts in Solidity, Web3 frontend, IPFS for metadata storage",
      "https://github.com/user/blockchain-voting",
      "alice_crypto",
      ["charlie_dev"],
      {
        language: "Solidity",
        framework: "Hardhat",
        stars: 89,
        lastCommit: "2024-06-12",
        topics: ["blockchain", "voting", "ethereum", "solidity"],
      }
    );

    console.log(`✅ Created projects: ${projectId1}, ${projectId2}\n`);

    // Read projects
    console.log("📖 Reading projects...");
    const allProjects = await githubService.findAll();
    console.log(`📊 Total projects: ${allProjects.length}`);

    const johnProjects = await githubService.getProjectsByOwner("john_doe");
    console.log(`👤 John's projects: ${johnProjects.length}`);

    const janeProjects = await githubService.getProjectsByCollaborator(
      "jane_smith"
    );
    console.log(`🤝 Jane's collaborations: ${janeProjects.length}`);

    // Search projects
    const aiProjects = await githubService.searchProjects("AI");
    console.log(`🔍 AI-related projects: ${aiProjects.length}`);

    // Display sample project
    if (allProjects.length > 0) {
      console.log("\n📄 Sample project:");
      const project = allProjects[0];
      console.log(`  Name: ${project.name}`);
      console.log(`  Owner: ${project.owner}`);
      console.log(`  Collaborators: ${project.collab.join(", ")}`);
      console.log(`  Language: ${project.metadata.language}`);
      console.log(`  Stars: ${project.metadata.stars}`);
    }

    console.log("\n✅ GitHub service test completed successfully!");
  } catch (error) {
    console.error("❌ GitHub service test failed:", error);
    process.exit(1);
  }
}

testGithub();
