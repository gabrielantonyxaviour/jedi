import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { KarmaSDKService } from "./karma";
import { KarmaProject } from "./project";

export class GrantService {
  constructor(
    private dynamoClient: DynamoDBClient,
    private karmaSDK: KarmaSDKService,
    private tableName: string
  ) {}

  async applyForGrant(payload: {
    projectId: string;
    grantTitle: string;
    grantDescription: string;
    communityUID: string;
    proposalURL?: string;
    cycle?: string;
    season?: string;
  }): Promise<{ grantUID: string; tx: string }> {
    const project = await this.karmaSDK.fetchProjectBySlug(payload.projectId);
    if (!project) {
      throw new Error(`Project ${payload.projectId} not found`);
    }

    const { uids, tx } = await this.karmaSDK.applyForGrant(
      {
        title: payload.grantTitle,
        description: payload.grantDescription,
        communityUID: payload.communityUID,
        proposalURL: payload.proposalURL,
        cycle: payload.cycle,
        season: payload.season,
      },
      project.uid as any
    );

    await this.updateProjectWithGrant(project.uid as any, {
      uid: uids[0],
      title: payload.grantTitle,
      description: payload.grantDescription,
      status: "PENDING",
      milestones: [],
    });

    return { grantUID: uids[0], tx };
  }

  async createMilestone(payload: {
    projectId: string;
    grantUID: string;
    title: string;
    description: string;
    endsAt: number;
  }): Promise<{ milestoneUID: string; tx: string }> {
    const project = await this.karmaSDK.fetchProjectBySlug(payload.projectId);
    if (!project) {
      throw new Error(`Project ${payload.projectId} not found`);
    }

    const { uids, tx } = await this.karmaSDK.createMilestone({
      title: payload.title,
      description: payload.description,
      endsAt: payload.endsAt,
      grantUID: payload.grantUID as any,
      projectUID: project.uid as any,
    });

    await this.updateProjectWithMilestone(
      project.uid as any,
      payload.grantUID,
      {
        uid: uids[0],
        title: payload.title,
        description: payload.description,
        status: "PENDING",
        endsAt: payload.endsAt,
      }
    );

    return { milestoneUID: uids[0], tx };
  }

  async updateMilestone(payload: {
    projectId: string;
    grantUID: string;
    milestoneUID: string;
    title: string;
    description: string;
    endsAt?: number;
  }): Promise<{ tx: string }> {
    const project = await this.karmaSDK.fetchProjectBySlug(payload.projectId);
    if (!project) {
      throw new Error(`Project ${payload.projectId} not found`);
    }

    const { tx } = await this.karmaSDK.updateMilestone(
      project.uid as any,
      payload.grantUID as any,
      payload.milestoneUID as any,
      {
        title: payload.title,
        description: payload.description,
        endsAt: payload.endsAt,
      }
    );

    await this.updateProjectWithMilestone(
      project.uid as any,
      payload.grantUID,
      {
        uid: payload.milestoneUID,
        title: payload.title,
        description: payload.description,
        status: "UPDATED",
        endsAt: payload.endsAt || 0,
      },
      true
    );

    return { tx };
  }

  private async updateProjectWithGrant(
    projectUID: string,
    grant: KarmaProject["grants"][0]
  ): Promise<void> {
    await this.dynamoClient.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ karmaProjectId: projectUID }),
        UpdateExpression:
          "SET grants = list_append(if_not_exists(grants, :empty_list), :grant), updatedAt = :now",
        ExpressionAttributeValues: marshall({
          ":grant": [grant],
          ":empty_list": [],
          ":now": new Date().toISOString(),
        }),
      })
    );
  }

  private async updateProjectWithMilestone(
    projectUID: string,
    grantUID: string,
    milestone: KarmaProject["grants"][0]["milestones"][0],
    isUpdate: boolean = false
  ): Promise<void> {
    const updateExpression = isUpdate
      ? "SET grants[?].milestones[?] = :milestone, updatedAt = :now"
      : "SET grants[?].milestones = list_append(if_not_exists(grants[?].milestones, :empty_list), :milestone), updatedAt = :now";

    await this.dynamoClient.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ karmaProjectId: projectUID }),
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: marshall({
          ":milestone": isUpdate ? milestone : [milestone],
          ":empty_list": [],
          ":now": new Date().toISOString(),
        }),
        ExpressionAttributeNames: {
          "#grantIndex": "grantIndex",
          "#milestoneIndex": "milestoneIndex",
        },
      })
    );
  }
}
