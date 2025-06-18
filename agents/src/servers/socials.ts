import dotenv from "dotenv";
import { SocialsAgent } from "../agents/socials";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

dotenv.config();

class SocialsServer {
  private agent: SocialsAgent;
  private sqsClient: SQSClient;
  private queueUrl: string;
  private isRunning = false;

  constructor() {
    this.agent = new SocialsAgent();
    this.sqsClient = new SQSClient({ region: process.env.AWS_REGION });
    this.queueUrl = process.env.SOCIALS_QUEUE_URL!;
  }

  async start() {
    console.log("🤖 Socials Agent starting...");
    console.log(`📥 Listening to queue: ${this.queueUrl}`);
    this.isRunning = true;
    await this.pollMessages();
  }

  async stop() {
    this.isRunning = false;
    console.log("🛑 Socials Agent stopped");
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
      console.log(`📋 Processing socials task: ${task.type} (${task.taskId})`);
      await this.agent.processTask(task);
      console.log(`✅ Socials task completed: ${task.taskId}`);
    } catch (error) {
      console.error("❌ Error processing socials message:", error);
    }
  }
}

const server = new SocialsServer();
server.start().catch((error) => {
  console.error("Failed to start Socials Agent server:", error);
  process.exit(1);
});
