// hooks/useQueues.ts
import { useState, useEffect } from "react";
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { useAppStore } from "../store/app-store";

const client = new SQSClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
  },
});

const QUEUE_URLS = {
  orchestrator: process.env.NEXT_PUBLIC_ORCHESTRATOR_QUEUE_URL!,
  github: process.env.NEXT_PUBLIC_GITHUB_INTELLIGENCE_QUEUE_URL!,
  socials: process.env.NEXT_PUBLIC_SOCIALS_QUEUE_URL!,
  leads: process.env.NEXT_PUBLIC_LEAD_GENERATION_QUEUE_URL!,
  emails: process.env.NEXT_PUBLIC_EMAIL_COMMUNICATION_QUEUE_URL!,
  ip: process.env.NEXT_PUBLIC_BLOCKCHAIN_IP_QUEUE_URL!,
  karma: process.env.NEXT_PUBLIC_KARMA_INTEGRATION_QUEUE_URL!,
  compliance: process.env.NEXT_PUBLIC_MONITORING_COMPLIANCE_QUEUE_URL!,
} as const;

type QueueName = keyof typeof QUEUE_URLS;

export const useQueues = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addLog = useAppStore((state) => state.addLog);

  const pollQueue = async (queueName: QueueName) => {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: QUEUE_URLS[queueName],
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
      });

      const response = await client.send(command);

      if (response.Messages && response.Messages.length > 0) {
        for (const message of response.Messages) {
          try {
            const task = JSON.parse(message.Body || "{}");
            addLog(JSON.stringify(task), queueName);

            // Delete the message after processing
            await client.send(
              new DeleteMessageCommand({
                QueueUrl: QUEUE_URLS[queueName],
                ReceiptHandle: message.ReceiptHandle,
              })
            );
          } catch (err) {
            addLog(
              `Error processing message from ${queueName}: ${
                err instanceof Error ? err.message : "Unknown error"
              }`,
              queueName,
              "error"
            );
          }
        }
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to poll queue";
      addLog(
        `Failed to poll ${queueName} queue: ${errorMsg}`,
        queueName,
        "error"
      );
    }
  };

  useEffect(() => {
    const pollAllQueues = async () => {
      for (const queueName of Object.keys(QUEUE_URLS) as QueueName[]) {
        await pollQueue(queueName);
      }
    };

    const interval = setInterval(pollAllQueues, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (
    queueName: QueueName,
    message: any,
    messageGroupId?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const command = new SendMessageCommand({
        QueueUrl: QUEUE_URLS[queueName],
        MessageBody: JSON.stringify(message),
        ...(messageGroupId && { MessageGroupId: messageGroupId }),
      });

      const response = await client.send(command);
      addLog(`Message sent to ${queueName} queue`, queueName);
      return response.MessageId;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to send message";
      setError(errorMsg);
      addLog(
        `Failed to send message to ${queueName} queue: ${errorMsg}`,
        queueName,
        "error"
      );
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return {
    sendMessage,
    loading,
    error,
    queues: QUEUE_URLS,
  };
};
