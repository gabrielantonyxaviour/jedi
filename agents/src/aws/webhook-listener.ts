import express from "express";

const app = express();

app.use(express.json());

app.post("/webhook", (req: any, res: any) => {
  console.log("🔔 Webhook received:");
  console.log("Headers:", req.headers);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  res.status(200).json({ received: true, timestamp: new Date().toISOString() });
});

const port = 4000;
app.listen(port, () => {
  console.log(`🎧 Webhook listener running on port ${port}`);
  console.log(`📡 Webhook URL: http://localhost:${port}/webhook`);
  console.log(`\n📝 To register this webhook, run:`);
  console.log(`curl -X POST http://localhost:3000/api/webhooks/register \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"webhookUrl": "http://localhost:${port}/webhook"}'`);
});
