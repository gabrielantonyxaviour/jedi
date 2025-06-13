// src/server.ts
import express from "express";
import { LeadScrapingService } from "./services/lead-scraper";
import { RateLimiter } from "./utils/rate-limiter";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const leadScraper = new LeadScrapingService();
const rateLimiter = new RateLimiter();

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Scrape leads endpoint
app.post(
  "/scrape-leads",
  rateLimiter.middleware(),
  async (req: any, res: any) => {
    try {
      const { project, sources = ["all"], maxResults = 100 } = req.body;

      if (!project || !project.name || !project.description) {
        return res
          .status(400)
          .json({ error: "Project name and description required" });
      }

      console.log(`🔍 Starting lead scraping for: ${project.name}`);

      const results = await leadScraper.scrapeLeads(
        project,
        sources,
        maxResults
      );

      res.json({
        success: true,
        project: project.name,
        totalLeads: results.length,
        sources: [...new Set(results.map((l) => l.source))],
        leads: results,
      });
    } catch (error: any) {
      console.error("Scraping error:", error);
      res.status(500).json({
        error: "Scraping failed",
        message: error.message,
      });
    }
  }
);

// Get scraping status
app.get("/status", (req, res) => {
  res.json({
    service: "Lead Scraping Service",
    availableSources: ["yc", "producthunt", "github", "f6s", "indiehackers"],
    rateLimit: rateLimiter.getStatus(),
  });
});

app.listen(port, () => {
  console.log(`🚀 Lead Scraping Service running on port ${port}`);
});
