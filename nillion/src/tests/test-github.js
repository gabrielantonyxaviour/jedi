"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const index_js_1 = require("../services/index.js");
async function testGithub() {
    console.log("🧪 Testing GitHub Service...\n");
    const githubService = index_js_1.ServiceFactory.getGithub();
    try {
        console.log("📝 Creating test GitHub projects...");
        const projectId1 = await githubService.createProject("AI Chat Assistant", "An intelligent chat assistant built with TypeScript and React", "Uses OpenAI GPT-4, implements RAG with vector database", "https://github.com/user/ai-chat-assistant", "john_doe", JSON.stringify(["jane_smith", "bob_wilson"]), "0x1234567890123456789012345678901234567890", JSON.stringify({
            language: "TypeScript",
            framework: "React",
            stars: 234,
        }));
        const projectId2 = await githubService.createProject("Blockchain Voting System", "Decentralized voting platform on Ethereum", "Smart contracts in Solidity, Web3 frontend", "https://github.com/user/blockchain-voting", "alice_crypto", JSON.stringify(["charlie_dev"]), "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", JSON.stringify({
            language: "Solidity",
            framework: "Hardhat",
            stars: 89,
        }));
        console.log(`✅ Created projects: ${projectId1}, ${projectId2}\n`);
        // Read projects
        console.log("📖 Reading projects...");
        const allProjects = await githubService.findAll();
        console.log(`📊 Total projects: ${allProjects.length}`);
        if (allProjects.length > 0) {
            console.log("\n📄 Sample project (encrypted):");
            const project = allProjects[0];
            console.log(`  Name: ${project.name["%share"]}`);
            console.log(`  Owner: ${project.owner["%share"]}`);
            console.log(`  Repo URL: ${project.repo_url["%share"]}`);
        }
        console.log("\n✅ GitHub service test completed successfully!");
    }
    catch (error) {
        console.error("❌ GitHub service test failed:", error);
        process.exit(1);
    }
}
testGithub();
