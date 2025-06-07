import dotenv from "dotenv";
import { CoreOrchestratorAgent } from "./agents/orchestrator";

dotenv.config();

async function main() {
  console.log("🚀 Starting Core Orchestrator Agent...");

  const orchestrator = new CoreOrchestratorAgent();
  orchestrator.start(3000);
}

main().catch(console.error);
