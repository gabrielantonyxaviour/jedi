// server.ts
import express from "express";
import cors from "cors";
import { SocialsService } from "./services/socials";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const socialsService = new SocialsService();

// Initialize service
(async () => {
  await socialsService.initialize();
  await socialsService.startScheduledMonitoring();
})();

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await socialsService.cleanup();
  process.exit(0);
});

// API Routes
app.post("/api/social/setup", async (req: any, res: any) => {
  try {
    const { userId, platform, credentials } = req.body;

    if (!userId || !platform || !credentials) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, platform, credentials",
      });
    }

    const result = await socialsService.setupSocial({
      userId,
      platform,
      credentials,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/social/post", async (req: any, res: any) => {
  try {
    const { userId, platform, content, mediaData, chatId } = req.body;

    if (!userId || !platform || !content) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, platform, content",
      });
    }

    const result = await socialsService.postContent({
      userId,
      platform,
      content,
      mediaData,
      chatId,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/social/monitoring", async (req: any, res: any) => {
  try {
    const { userId, platform, ...config } = req.body;

    if (!userId || !platform) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, platform",
      });
    }

    const result = await socialsService.updateMonitoringConfig({
      userId,
      platform,
      ...config,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/social/fetch-engage", async (req: any, res: any) => {
  try {
    const { userId, platform } = req.body;

    if (!userId || !platform) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, platform",
      });
    }

    const result = await socialsService.fetchAndEngage(userId, platform);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/social/status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const status = await socialsService.getUserStatus(userId);
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/social/health", (req, res) => {
  res.json({
    success: true,
    message: "Socials service is running",
    timestamp: new Date().toISOString(),
  });
});

// Telegram webhook endpoint (optional for production)
app.post("/api/telegram/webhook/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const webhook = socialsService.getTelegramWebhook(userId);
    await webhook(req, res);
  } catch (error: any) {
    res.status(404).json({ success: false, message: "Bot not found for user" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Socials service initialized and ready`);
});
