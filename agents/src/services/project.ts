import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
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
  ownerAddress: string;
  init_state: "GITHUB" | "SETUP" | "SOCIALS" | "KARMA" | "IP";

  // Karma integration fields
  karmaUID?: string;
  karmaStatus?: "draft" | "active" | "completed";
  karmaMembers?: string[];
  karmaGrants?: Array<{
    uid: string;
    title: string;
    status: string;
    milestones: Array<{
      uid: string;
      title: string;
      status: string;
      dueDate: string;
    }>;
  }>;
  karmaSyncedAt?: string;

  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export class ProjectService {
  constructor(private dynamoClient: DynamoDBClient) {}

  async createProject(
    project: Omit<ProjectInfo, "createdAt" | "updatedAt" | "init_state">
  ): Promise<ProjectInfo> {
    const now = new Date().toISOString();
    const projectInfo: ProjectInfo = {
      ...project,
      init_state: "GITHUB", // Start with GITHUB state
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: "projects",
        Item: marshall(projectInfo, { removeUndefinedValues: true }),
      })
    );

    return projectInfo;
  }

  async updateProjectInitState(
    projectId: string,
    newState: ProjectInfo["init_state"]
  ): Promise<void> {
    await this.dynamoClient.send(
      new UpdateItemCommand({
        TableName: "projects",
        Key: marshall({ projectId }),
        UpdateExpression: "SET init_state = :state, updatedAt = :now",
        ExpressionAttributeValues: marshall(
          {
            ":state": newState,
            ":now": new Date().toISOString(),
          },
          { removeUndefinedValues: true }
        ),
      })
    );
  }

  async updateProjectWithKarmaData(
    projectId: string,
    karmaData: {
      karmaUID: string;
      title?: string;
      description?: string;
      status?: "draft" | "active" | "completed";
      members?: string[];
      grants?: ProjectInfo["karmaGrants"];
    }
  ): Promise<ProjectInfo> {
    const updates: any = {
      karmaUID: karmaData.karmaUID,
      karmaStatus: karmaData.status || "active",
      karmaMembers: karmaData.members || [],
      karmaGrants: karmaData.grants || [],
      karmaSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      init_state: "KARMA", // Update state to KARMA
    };

    // Update name/description if provided
    if (karmaData.title) updates.name = karmaData.title;
    if (karmaData.description) updates.description = karmaData.description;

    const updateExpressions: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    Object.keys(updates).forEach((key) => {
      // Handle reserved keywords
      if (key === "name") {
        updateExpressions.push(`#projectName = :${key}`);
        expressionAttributeNames["#projectName"] = "name";
      } else if (key === "status") {
        updateExpressions.push(`#projectStatus = :${key}`);
        expressionAttributeNames["#projectStatus"] = "status";
      } else {
        updateExpressions.push(`${key} = :${key}`);
      }
      expressionAttributeValues[`:${key}`] = updates[key];
    });

    const params: any = {
      TableName: "projects",
      Key: marshall({ projectId }),
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeValues: marshall(expressionAttributeValues, {
        removeUndefinedValues: true,
      }),
    };

    // Only add ExpressionAttributeNames if we have any
    if (Object.keys(expressionAttributeNames).length > 0) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    await this.dynamoClient.send(new UpdateItemCommand(params));

    return (await this.getProject(projectId)) as ProjectInfo;
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

  async getProjectsByInitState(
    initState: ProjectInfo["init_state"]
  ): Promise<ProjectInfo[]> {
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: "projects",
        IndexName: "InitStateIndex", // You'll need to create this GSI
        KeyConditionExpression: "init_state = :state",
        ExpressionAttributeValues: marshall({
          ":state": initState,
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
        Item: marshall(updatedProject, { removeUndefinedValues: true }),
      })
    );

    return updatedProject;
  }
}
