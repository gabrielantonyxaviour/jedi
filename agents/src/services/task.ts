import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export interface TaskInfo {
  taskId: string;
  workflowId: string;
  type: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  payload: Record<string, any>;
  payload?: Record<string, any>;
  error?: string;
  characterResponse?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export class TaskService {
  constructor(
    private dynamoClient: DynamoDBClient,
    private sqsClient: SQSClient,
    private orchestratorQueue: string
  ) {}

  async createTask(
    task: Omit<TaskInfo, "createdAt" | "updatedAt" | "status">
  ): Promise<TaskInfo> {
    const now = new Date().toISOString();
    const taskInfo: TaskInfo = {
      ...task,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: process.env.TASK_STATUS_TABLE || "orchestrator-tasks",
        Item: marshall(taskInfo),
      })
    );

    return taskInfo;
  }

  async getTask(taskId: string): Promise<TaskInfo | null> {
    const payload = await this.dynamoClient.send(
      new GetItemCommand({
        TableName: process.env.TASK_STATUS_TABLE || "orchestrator-tasks",
        Key: marshall({ taskId }),
      })
    );

    if (!payload.Item) {
      return null;
    }

    return unmarshall(payload.Item) as TaskInfo;
  }

  async updateTaskStatus(
    taskId: string,
    status: TaskInfo["status"],
    payload?: Record<string, any>,
    error?: string,
    characterResponse?: string
  ): Promise<TaskInfo> {
    const updates: any = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (payload) updates.payload = payload;
    if (error) updates.error = error;
    if (characterResponse) updates.characterResponse = characterResponse;
    if (status === "COMPLETED" || status === "FAILED") {
      updates.completedAt = new Date().toISOString();
    }

    await this.dynamoClient.send(
      new UpdateItemCommand({
        TableName: process.env.TASK_STATUS_TABLE || "orchestrator-tasks",
        Key: marshall({ taskId }),
        UpdateExpression:
          "SET #status = :status, #updatedAt = :updatedAt, #payload = :payload, #error = :error, #characterResponse = :characterResponse, #completedAt = :completedAt",
        ExpressionAttributeNames: {
          "#status": "status",
          "#updatedAt": "updatedAt",
          "#payload": "payload",
          "#error": "error",
          "#characterResponse": "characterResponse",
          "#completedAt": "completedAt",
        },
        ExpressionAttributeValues: marshall(updates),
      })
    );

    // Notify orchestrator
    await this.sqsClient.send(
      new SendMessageCommand({
        QueueUrl: this.orchestratorQueue,
        MessageBody: JSON.stringify({
          type: "TASK_COMPLETION",
          taskId,
          workflowId: (await this.getTask(taskId))?.workflowId,
          status,
          payload,
          error,
          characterResponse,
          timestamp: new Date().toISOString(),
        }),
      })
    );

    return (await this.getTask(taskId))!;
  }

  async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    payload: any,
    error?: string,
    characterResponse?: string
  ) {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    if (task.status === "COMPLETED" || task.status === "FAILED") {
      throw new Error(`Task ${taskId} already completed`);
    }
    if (task.workflowId !== workflowId) {
      throw new Error(
        `Task ${taskId} does not belong to workflow ${workflowId}`
      );
    }

    if (error) {
      await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: this.orchestratorQueue,
          MessageBody: JSON.stringify({
            type: "TASK_COMPLETION",
            taskId,
            workflowId,
            status: "FAILED",
            payload,
            error,
            characterResponse,
            timestamp: new Date().toISOString(),
          }),
        })
      );
    } else {
      await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: this.orchestratorQueue,
          MessageBody: JSON.stringify({
            type: "TASK_COMPLETION",
            taskId,
            workflowId,
            status: "COMPLETED",
            payload,
            characterResponse,
            timestamp: new Date().toISOString(),
          }),
        })
      );
    }
  }
}
