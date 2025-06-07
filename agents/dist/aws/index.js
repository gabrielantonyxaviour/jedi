import { config } from "dotenv";
import { GitHubIntelligenceAgent } from "./agents/github";
config(); // Load environment variables
async function testGitHubAgent() {
    const agent = new GitHubIntelligenceAgent();
    try {
        // Test with a public repo
        const result = await agent.analyzeRepository("https://github.com/gabrielantonyxaviour/franky-agent-router");
        console.log("Analysis Result:", result);
    }
    catch (error) {
        console.error("Error:", error.message);
    }
}
// Run test
testGitHubAgent();
