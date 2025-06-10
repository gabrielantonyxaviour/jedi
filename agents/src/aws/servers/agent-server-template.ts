import dotenv from "dotenv";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

dotenv.config();

export class AgentServer {
  private agent: any;
  private sqsClient: SQSClient;
  private queueUrl: string;
  private isRunning = false;
  private agentName: string;

  constructor(agent: any, queueUrl: string, agentName: string) {
    this.agent = agent;
    this.sqsClient = new SQSClient({ region: process.env.AWS_REGION });
    this.queueUrl = queueUrl;
    this.agentName = agentName;
  }

  async start() {
    console.log(`🤖 ${this.agentName} starting...`);
    console.log(`📥 Listening to queue: ${this.queueUrl}`);
    this.isRunning = true;
    await this.pollMessages();
  }

  async stop() {
    this.isRunning = false;
    console.log(`🛑 ${this.agentName} stopped`);
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
      await this.agent.processTask(task);
      console.log(`✅ Task completed: ${task.taskId}`);
    } catch (error: any) {
      console.error("❌ Error processing message:", error);
    }
  }
}
