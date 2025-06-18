import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { KarmaSDKService } from "./karma";

export interface KarmaProject {
  karmaProjectId: string;
  projectId: string;
  karmaUID: string;
  title: string;
  description: string;
  status: string;
  ownerAddress: string;
  members: string[];
  grants: Array<{
    uid: string;
    title: string;
    description: string;
    status: string;
    milestones: Array<{
      uid: string;
      title: string;
      description: string;
      status: string;
      endsAt: number;
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

export class ProjectService {
  constructor(
    private dynamoClient: DynamoDBClient,
    private karmaSDK: KarmaSDKService,
    private tableName: string
  ) {}

  async createKarmaProject(payload: {
    projectId: string;
    title: string;
    description: string;
    ownerAddress: string;
    members?: string[];
  }): Promise<KarmaProject> {
    const { uid, project } = await this.karmaSDK.createProject({
      title: payload.title,
      description: payload.description,
      ownerAddress: payload.ownerAddress as any,
      members: payload.members as any[],
    });

    const karmaProject: KarmaProject = {
      karmaProjectId: uid,
      projectId: payload.projectId,
      karmaUID: uid,
      title: payload.title,
      description: payload.description,
      status: "ACTIVE",
      ownerAddress: payload.ownerAddress,
      members: payload.members || [],
      grants: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    };

    await this.storeKarmaProject(karmaProject);
    return karmaProject;
  }

  async getKarmaProject(karmaProjectId: string): Promise<KarmaProject | null> {
    const result = await this.dynamoClient.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ karmaProjectId }),
      })
    );

    if (!result.Item) {
      return null;
    }

    return unmarshall(result.Item) as KarmaProject;
  }

  async getKarmaProjectByProjectId(
    projectId: string
  ): Promise<KarmaProject | null> {
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "ProjectIdIndex",
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({
          ":projectId": projectId,
        }),
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return unmarshall(result.Items[0]) as KarmaProject;
  }

  async getAllKarmaProjects(): Promise<KarmaProject[]> {
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "status = :status",
        ExpressionAttributeValues: marshall({
          ":status": "ACTIVE",
        }),
      })
    );

    return (result.Items || []).map((item) => unmarshall(item) as KarmaProject);
  }

  private async storeKarmaProject(project: KarmaProject): Promise<void> {
    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(project),
      })
    );
  }
}
