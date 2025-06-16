import dotenv from "dotenv";
dotenv.config();

import "./utils/crypto-polyfill.js"; // Import polyfill first
import { CoreOrchestratorAgent } from "./agents/orchestrator.js";

async function main() {
  console.log("🚀 Starting Core Orchestrator Agent...");

  const orchestrator = new CoreOrchestratorAgent();
  orchestrator.start(3000);
}

main().catch(console.error);
