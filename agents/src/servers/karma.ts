import dotenv from "dotenv";
import { KarmaAgent } from "../agents/karma";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";

dotenv.config();

export class KarmaServer {
  private sqs: SQSClient;
  private queueUrl: string;
  private karmaAgent: KarmaAgent;
  private orchestratorQueue: string;

  constructor() {
    console.log("🔧 Initializing Karma server...");
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.queueUrl = process.env.KARMA_INTEGRATION_QUEUE_URL!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
    this.karmaAgent = new KarmaAgent();
    console.log("✅ Karma server initialized");
  }

  async start(): Promise<void> {
    console.log("🚀 Starting Karma agent server...");
    this.pollMessages();
  }

  private async pollMessages(): Promise<void> {
    console.log("📡 Starting message polling loop in Karma...");
    while (true) {
      try {
        console.log("🔍 Polling for new messages in Karma...");
        const result = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
          })
        );

        if (result.Messages) {
          console.log(`📨 Received ${result.Messages.length} messages`);
          for (const message of result.Messages) {
            try {
              console.log("🔄 Processing message...");
              const task = JSON.parse(message.Body!);
              await this.processMessage(task);

              console.log("🗑️ Deleting processed message...");
              await this.sqs.send(
                new DeleteMessageCommand({
                  QueueUrl: this.queueUrl,
                  ReceiptHandle: message.ReceiptHandle!,
                })
              );
              console.log("✅ Message processed and deleted successfully");
            } catch (error) {
              console.error("❌ Error processing Karma message:", error);
            }
          }
        } else {
          console.log("⏳ No messages received, waiting...");
        }
      } catch (error) {
        console.error("❌ Error polling Karma SQS:", error);
        console.log("⏳ Waiting 5 seconds before retrying...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async processMessage(task: any): Promise<void> {
    console.log(`🔄 Processing task ${task.taskId}...`);
    try {
      const result = await this.karmaAgent.processTask(task);
      console.log(`✅ Task ${task.taskId} processed successfully`);
      await this.reportTaskCompletion(task.taskId, task.workflowId, result);
    } catch (error: any) {
      console.error(`❌ Karma task ${task.taskId} failed: ${error.message}`);
      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        null,
        error.message
      );
    }
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string
  ) {
    console.log(`📤 Reporting completion for task ${taskId}...`);
    try {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: this.orchestratorQueue,
          MessageBody: JSON.stringify({
            type: "TASK_COMPLETION",
            payload: {
              taskId,
              workflowId,
              status: error ? "FAILED" : "COMPLETED",
              result,
              error,
              timestamp: new Date().toISOString(),
              agent: "karma-integration",
            },
          }),
        })
      );
      console.log(`✅ Task ${taskId} completion reported successfully`);
    } catch (err) {
      console.error(`❌ Failed to report task ${taskId} completion:`, err);
    }
  }
}

const server = new KarmaServer();
server.start().catch((error) => {
  console.error("💥 Failed to start Karma Agent server:", error);
  process.exit(1);
});
