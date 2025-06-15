import dotenv from "dotenv";
import { IPAgent } from "../agents/ip";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

dotenv.config();

class IPServer {
  private agent: IPAgent;
  private sqsClient: SQSClient;
  private queueUrl: string;
  private isRunning = false;

  constructor() {
    console.log("🔧 Initializing IP Server...");
    this.agent = new IPAgent();
    this.sqsClient = new SQSClient({ region: process.env.AWS_REGION });
    this.queueUrl = process.env.BLOCKCHAIN_IP_QUEUE_URL!;
    console.log("✅ IP Server initialized");
  }

  async start() {
    console.log("🤖 IP Agent starting...");
    console.log(`📥 Listening to queue: ${this.queueUrl}`);
    this.isRunning = true;
    await this.pollMessages();
  }

  async stop() {
    console.log("🛑 Stopping IP Agent...");
    this.isRunning = false;
    console.log("✅ IP Agent stopped");
  }

  private async pollMessages() {
    console.log("🔄 Starting message polling loop");
    while (this.isRunning) {
      try {
        console.log("📡 Polling for new messages...");
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 10,
        });

        const response = await this.sqsClient.send(command);
        console.log(`📨 Received ${response.Messages?.length || 0} messages`);

        if (response.Messages) {
          for (const message of response.Messages) {
            console.log(`📝 Processing message ${message.MessageId}`);
            await this.processMessage(message);
            console.log(`🗑️ Deleting processed message ${message.MessageId}`);
            await this.sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: message.ReceiptHandle!,
              })
            );
            console.log(`✅ Message ${message.MessageId} deleted`);
          }
        }
      } catch (error) {
        console.error("❌ Error polling messages:", error);
        console.log("⏳ Waiting 5 seconds before retrying...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async processMessage(message: any) {
    try {
      const task = JSON.parse(message.Body);
      console.log(`📋 Processing IP task: ${task.type} (${task.taskId})`);
      console.log(`📦 Task payload:`, JSON.stringify(task.payload, null, 2));

      // Validate required fields
      if (!task.type || !task.taskId || !task.payload) {
        throw new Error("Missing required task fields");
      }

      // Set defaults for missing values
      const finalPayload = {
        ...task.payload,
        license: task.payload.license || "MIT",
        licenseTermsData: task.payload.licenseTermsData || [],
      };

      await this.agent.processTask({
        ...task,
        payload: finalPayload,
      });
      console.log(`✅ IP task completed: ${task.taskId}`);
    } catch (error) {
      console.error("❌ Error processing IP message:", error);
      console.error("📄 Message content:", message.Body);
      throw error; // Re-throw to trigger retry mechanism
    }
  }
}

console.log("🚀 Starting IP Server...");
const server = new IPServer();
server.start().catch((error) => {
  console.error("💥 Failed to start IP Agent server:", error);
  process.exit(1);
});
