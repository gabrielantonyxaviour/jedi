// agents/social-media-agent.ts (for SQS-based agent)
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { SocialsService } from "../services/socials";

export class SocialsAgent {
  private sqs: SQSClient;
  private queueUrl: string;
  private socialsService: SocialsService;

  constructor() {
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.queueUrl = process.env.SOCIALS_QUEUE_URL!;
    this.socialsService = new SocialsService();
  }

  async startListening(): Promise<void> {
    console.log("🚀 Starting socials agent...");

    await this.socialsService.initialize();
    await this.socialsService.startScheduledMonitoring();

    this.pollSQSMessages();
  }

  private async pollSQSMessages(): Promise<void> {
    while (true) {
      try {
        const result = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
          })
        );

        if (result.Messages) {
          for (const message of result.Messages) {
            try {
              const task = JSON.parse(message.Body!);
              await this.processTask(task);

              await this.sqs.send(
                new DeleteMessageCommand({
                  QueueUrl: this.queueUrl,
                  ReceiptHandle: message.ReceiptHandle!,
                })
              );
            } catch (error) {
              console.error("Error processing message:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error polling SQS:", error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  async processTask(task: any): Promise<void> {
    console.log(`📱 Processing task: ${task.type}`);

    try {
      let result;

      switch (task.type) {
        case "SETUP_SOCIAL":
          result = await this.socialsService.setupSocial(task.payload);
          break;
        case "POST_CONTENT":
          result = await this.socialsService.postContent(task.payload);
          break;
        case "FETCH_AND_ENGAGE":
          result = await this.socialsService.fetchAndEngage(
            task.payload.userId,
            task.payload.platform
          );
          break;
        case "UPDATE_MONITORING":
          result = await this.socialsService.updateMonitoringConfig(
            task.payload
          );
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      if (!result.success) {
        throw new Error(result.message);
      }

      console.log(`✅ Task completed: ${task.type}`);
    } catch (error: any) {
      console.error(`❌ Task failed: ${error.message}`);
      throw error;
    }
  }
}
