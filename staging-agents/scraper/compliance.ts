// src/compliance-server.ts
import express from "express";
import { ComplianceScrapingService } from "./services/compliance";
import { RateLimiter } from "./utils/rate-limiter";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;
const complianceScraper = new ComplianceScrapingService();
const rateLimiter = new RateLimiter();

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Scrape similar projects endpoint
app.post(
  "/scrape-compliance",
  rateLimiter.middleware(),
  async (req: any, res: any) => {
    try {
      const { project, sources = ["all"], maxResults = 50 } = req.body;

      if (!project || !project.name || !project.description) {
        return res
          .status(400)
          .json({ error: "Project name and description required" });
      }

      console.log(`🔍 Starting compliance scraping for: ${project.name}`);

      const results = await complianceScraper.scrapeProjects(
        project,
        sources,
        maxResults
      );

      // Sort by similarity (highest first)
      const sortedResults = results.sort((a, b) => b.similarity - a.similarity);

      // Flag high similarity projects
      const flaggedProjects = sortedResults.filter((p) => p.similarity > 85);
      const suspiciousProjects = sortedResults.filter(
        (p) => p.similarity > 70 && p.similarity <= 85
      );

      res.json({
        success: true,
        project: project.name,
        totalFound: results.length,
        flaggedCount: flaggedProjects.length,
        suspiciousCount: suspiciousProjects.length,
        sources: [...new Set(results.map((p) => p.source))],
        summary: {
          highRisk: flaggedProjects.length,
          mediumRisk: suspiciousProjects.length,
          lowRisk:
            results.length - flaggedProjects.length - suspiciousProjects.length,
        },
        flaggedProjects: flaggedProjects.slice(0, 10), // Top 10 most similar
        allProjects: sortedResults,
      });
    } catch (error: any) {
      console.error("Compliance scraping error:", error);
      res.status(500).json({
        error: "Compliance scraping failed",
        message: error.message,
      });
    }
  }
);

// Analyze specific project similarity
app.post("/analyze-similarity", async (req: any, res: any) => {
  try {
    const { originalProject, comparisonProject } = req.body;

    if (!originalProject || !comparisonProject) {
      return res.status(400).json({
        error: "Both original and comparison projects required",
      });
    }

    // Simple similarity calculation for testing
    const nameSimilarity = calculateTextSimilarity(
      originalProject.name.toLowerCase(),
      comparisonProject.projectName.toLowerCase()
    );

    const descSimilarity = calculateTextSimilarity(
      originalProject.description.toLowerCase(),
      comparisonProject.description.toLowerCase()
    );

    const overallSimilarity = Math.round(
      nameSimilarity * 0.4 + descSimilarity * 0.6
    );

    res.json({
      similarity: overallSimilarity,
      breakdown: {
        nameMatch: Math.round(nameSimilarity),
        descriptionMatch: Math.round(descSimilarity),
      },
      riskLevel:
        overallSimilarity > 85
          ? "HIGH"
          : overallSimilarity > 70
          ? "MEDIUM"
          : "LOW",
      recommendation:
        overallSimilarity > 90
          ? "Flag for review"
          : overallSimilarity > 75
          ? "Manual investigation needed"
          : "Likely safe",
    });
  } catch (error: any) {
    console.error("Analysis error:", error);
    res.status(500).json({
      error: "Similarity analysis failed",
      message: error.message,
    });
  }
});

// Get scraping status and available sources
app.get("/status", (req, res) => {
  res.json({
    service: "Compliance Scraping Service",
    availableSources: ["ethglobal", "dorahacks", "devfolio", "github"],
    rateLimit: rateLimiter.getStatus(),
    description: "Scans for similar/copied projects across web3 platforms",
  });
});

// Test endpoint with sample data
app.get("/test", async (req, res) => {
  const sampleProject = {
    name: "DeFi Lending Protocol",
    description:
      "A decentralized lending platform that allows users to lend and borrow cryptocurrency assets with automated interest rates.",
    projectId: "test-project-123",
  };

  res.json({
    message: "Use this sample project for testing",
    sampleProject,
    testEndpoint: "/scrape-compliance",
    sampleRequest: {
      project: sampleProject,
      sources: ["ethglobal", "github"],
      maxResults: 10,
    },
  });
});

// Helper function for text similarity (simple implementation)
function calculateTextSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 100;

  const words1 = text1.split(/\s+/);
  const words2 = text2.split(/\s+/);

  const commonWords = words1.filter((word) =>
    words2.some((w2) => w2.includes(word) || word.includes(w2))
  );

  const similarity =
    ((commonWords.length * 2) / (words1.length + words2.length)) * 100;
  return Math.min(similarity, 100);
}

app.listen(port, () => {
  console.log(`🔒 Compliance Scraping Service running on port ${port}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /status - Service status`);
  console.log(`   GET  /test - Sample project data`);
  console.log(`   POST /scrape-compliance - Scrape for similar projects`);
  console.log(`   POST /analyze-similarity - Analyze project similarity`);
});
