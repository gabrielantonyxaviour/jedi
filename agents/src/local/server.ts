// src/server.ts
import express, { Request, Response } from "express";
import { config } from "dotenv";
import { UniversalGitHubAgent } from "./agents/github";
import { WebhookHandler } from "./handlers/webhook";
import { ProjectDataManager } from "./managers/project-data";
import { parseRepoUrl } from "../aws/utils";

config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Initialize services
const githubAgent = new UniversalGitHubAgent();
const dataManager = new ProjectDataManager();
const webhookHandler = new WebhookHandler(githubAgent, dataManager);

// Routes
app.post("/api/analyze", async (req: any, res: any) => {
  try {
    const { repoUrl } = req.body;

    if (!repoUrl) {
      return res.status(400).json({ error: "repoUrl is required" });
    }

    const { owner, repo } = parseRepoUrl(repoUrl);

    console.log(`🔍 Starting analysis for ${repoUrl} (user: ${owner})`);

    // Perform initial analysis
    const analysis = await githubAgent.analyzeRepository(repoUrl);

    // Register webhook for future commits
    const webhookUrl = await webhookHandler.registerWebhook(repoUrl);

    res.json({
      success: true,
      analysis,
      webhookUrl,
      message: "Analysis complete and webhook registered",
    });
  } catch (error: any) {
    console.error("Analysis error:", error);
    res.status(500).json({
      error: "Analysis failed",
      details: error.message,
    });
  }
});

app.get("/api/project/:owner/:repo", async (req: any, res: any) => {
  try {
    const { owner, repo } = req.params;

    const projectData = await dataManager.getProjectData(owner, repo);

    if (!projectData) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(projectData);
  } catch (error: any) {
    console.error("Get project error:", error);
    res.status(500).json({
      error: "Failed to get project data",
      details: error.message,
    });
  }
});

// GitHub webhook endpoint
app.post("/webhook/github", async (req, res) => {
  try {
    await webhookHandler.handleWebhook(req, res);
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook/github`);
  console.log(
    `🔍 Analysis endpoint: POST http://localhost:${PORT}/api/analyze`
  );
  console.log(
    `📊 Get project: GET http://localhost:${PORT}/api/project/:owner/:repo`
  );
});
