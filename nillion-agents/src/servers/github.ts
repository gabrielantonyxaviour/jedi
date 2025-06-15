import dotenv from "dotenv";
import { GitHubIntelligenceAgent } from "../agents/github";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

dotenv.config();

class GitHubAgentServer {
  private agent: GitHubIntelligenceAgent;
  private sqsClient: SQSClient;
  private queueUrl: string;
  private isRunning = false;

  constructor() {
    this.agent = new GitHubIntelligenceAgent();
    this.sqsClient = new SQSClient({ region: process.env.AWS_REGION });
    this.queueUrl = process.env.GITHUB_INTELLIGENCE_QUEUE_URL!;

    if (!this.queueUrl) {
      console.log("⚠️  No SQS queue configured, running in standalone mode");
    }
  }

  async start() {
    console.log("🤖 GitHub Intelligence Agent starting...");

    if (this.queueUrl) {
      console.log(`📥 Listening to queue: ${this.queueUrl}`);
      this.isRunning = true;
      await this.pollMessages();
    } else {
      console.log(
        "📋 Running in standalone mode - use orchestrator API to trigger tasks"
      );
      // Keep process alive
      setInterval(() => {}, 60000);
    }
  }

  async stop() {
    this.isRunning = false;
    console.log("🛑 GitHub Intelligence Agent stopped");
  }

  private async pollMessages() {
    while (this.isRunning) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 10,
        });

        const response = await this.sqsClient.send(command);

        if (response.Messages) {
          for (const message of response.Messages) {
            await this.processMessage(message);

            await this.sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: message.ReceiptHandle!,
              })
            );
          }
        }
      } catch (error) {
        console.error("❌ Error polling messages:", error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async processMessage(message: any) {
    try {
      const task = JSON.parse(message.Body);
      console.log(`📋 Processing task: ${task.type} (${task.taskId})`);
      const result = await this.agent.processTask(task);

      console.log(`✅ Task completed: ${task.taskId}`);
    } catch (error: any) {
      console.error("❌ Error processing message:", error);
    }
  }
}

const server = new GitHubAgentServer();
server.start().catch(console.error);

process.on("SIGINT", async () => {
  await server.stop();
  process.exit(0);
});
