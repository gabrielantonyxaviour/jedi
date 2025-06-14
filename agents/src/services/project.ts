import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
interface Developer {
  name: string;
  github_username: string;
}
export interface ProjectInfo {
  projectId: string;
  name: string;
  repo: string;
  developers: Developer[];
  side: string;
  summary?: string;
  technicalSummary?: string;
  ownerId: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export class ProjectService {
  constructor(private dynamoClient: DynamoDBClient) {}

  async createProject(
    project: Omit<ProjectInfo, "createdAt" | "updatedAt">
  ): Promise<ProjectInfo> {
    const now = new Date().toISOString();
    const projectInfo: ProjectInfo = {
      ...project,
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: "projects",
        Item: marshall(projectInfo),
      })
    );

    return projectInfo;
  }

  async getProject(projectId: string): Promise<ProjectInfo | null> {
    const result = await this.dynamoClient.send(
      new GetItemCommand({
        TableName: "projects",
        Key: marshall({ projectId }),
      })
    );

    if (!result.Item) {
      return null;
    }

    return unmarshall(result.Item) as ProjectInfo;
  }

  async getProjectsByOwner(ownerId: string): Promise<ProjectInfo[]> {
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: "projects",
        IndexName: "OwnerIndex",
        KeyConditionExpression: "ownerId = :ownerId",
        ExpressionAttributeValues: marshall({
          ":ownerId": ownerId,
        }),
      })
    );

    return (result.Items || []).map((item) => unmarshall(item) as ProjectInfo);
  }

  async updateProject(
    projectId: string,
    updates: Partial<ProjectInfo>
  ): Promise<ProjectInfo> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updatedProject: ProjectInfo = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: "projects",
        Item: marshall(updatedProject),
      })
    );

    return updatedProject;
  }
}
