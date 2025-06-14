// hooks/useQueues.ts
import { useState } from "react";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
  },
});

const QUEUE_URLS = {
  orchestrator: process.env.NEXT_PUBLIC_ORCHESTRATOR_QUEUE_URL!,
  githubIntelligence: process.env.NEXT_PUBLIC_GITHUB_INTELLIGENCE_QUEUE_URL!,
  socialMedia: process.env.NEXT_PUBLIC_SOCIAL_MEDIA_QUEUE_URL!,
  leadGeneration: process.env.NEXT_PUBLIC_LEAD_GENERATION_QUEUE_URL!,
  emailCommunication: process.env.NEXT_PUBLIC_EMAIL_COMMUNICATION_QUEUE_URL!,
  blockchainIp: process.env.NEXT_PUBLIC_BLOCKCHAIN_IP_QUEUE_URL!,
  karmaIntegration: process.env.NEXT_PUBLIC_KARMA_INTEGRATION_QUEUE_URL!,
  monitoringCompliance:
    process.env.NEXT_PUBLIC_MONITORING_COMPLIANCE_QUEUE_URL!,
} as const;

type QueueName = keyof typeof QUEUE_URLS;

export const useQueues = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      return response.MessageId;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to send message";
      setError(errorMsg);
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
