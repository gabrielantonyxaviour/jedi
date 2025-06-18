import dotenv from "dotenv";
import { KarmaAgent } from "../agents/karma";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

dotenv.config();

class KarmaServer {
  private agent: KarmaAgent;
  private sqsClient: SQSClient;
  private queueUrl: string;
  private isRunning = false;

  constructor() {
    this.agent = new KarmaAgent();
    this.sqsClient = new SQSClient({ region: process.env.AWS_REGION });
    this.queueUrl = process.env.KARMA_INTEGRATION_QUEUE_URL!;
  }

  async start() {
    console.log("🤖 Karma Agent starting...");
    console.log(`📥 Listening to queue: ${this.queueUrl}`);
    this.isRunning = true;
    await this.pollMessages();
  }

  async stop() {
    this.isRunning = false;
    console.log("🛑 Karma Agent stopped");
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
      console.log(`📋 Processing karma task: ${task.type} (${task.taskId})`);
      await this.agent.processTask(task);
      console.log(`✅ Karma task completed: ${task.taskId}`);
    } catch (error) {
      console.error("❌ Error processing karma message:", error);
    }
  }
}

const server = new KarmaServer();
server.start().catch((error) => {
  console.error("Failed to start Karma Agent server:", error);
  process.exit(1);
});
