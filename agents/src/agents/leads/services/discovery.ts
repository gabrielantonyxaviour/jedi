import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { Lead } from "./lead";

export interface DiscoveryResult {
  leads: Lead[];
  source: string;
  metadata: Record<string, any>;
}

export class DiscoveryService {
  constructor(
    private dynamodb: DynamoDBClient,
    private s3: S3Client,
    private bedrock: BedrockRuntimeClient,
    private sqs: SQSClient,
    private leadsTableName: string,
    private projectsTableName: string,
    private bucketName: string,
    private orchestratorQueue: string
  ) {}

  async discoverLeads(payload: {
    projectId: string;
    source: string;
  }): Promise<DiscoveryResult> {
    console.log(
      `🔍 Discovering leads for project: ${payload.projectId} from source: ${payload.source}`
    );

    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const leads = await this.searchLeads(project, payload.source);
    const enrichedLeads = await this.enrichLeads(leads, project);
    const scoredLeads = await this.scoreLeads(enrichedLeads, project);

    // Store leads in DynamoDB
    await Promise.all(scoredLeads.map((lead) => this.storeLead(lead)));

    // Store discovery results in S3
    const discoveryId = randomUUID();
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `discoveries/${discoveryId}.json`,
        Body: JSON.stringify({
          projectId: payload.projectId,
          source: payload.source,
          leads: scoredLeads,
          timestamp: new Date().toISOString(),
        }),
        ContentType: "application/json",
      })
    );

    // Notify orchestrator
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.orchestratorQueue,
        MessageBody: JSON.stringify({
          type: "LEAD_DISCOVERY_COMPLETE",
          payload: {
            projectId: payload.projectId,
            source: payload.source,
            discoveryId,
            leadCount: scoredLeads.length,
          },
        }),
      })
    );

    return {
      leads: scoredLeads,
      source: payload.source,
      metadata: {
        discoveryId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async searchLeads(
    project: any,
    source: string
  ): Promise<Partial<Lead>[]> {
    const prompt = `
Find potential leads for this project:

Project:
- Name: ${project.name}
- Description: ${project.description}
- Industry: ${project.industry || "Any"}

Source: ${source}

Return a list of potential leads with:
- Name
- Company
- Title
- Industry
- Location
- Website (if available)
- Email (if available)
- Match reason

Format as JSON array.
`;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          prompt,
          max_tokens: 2000,
          temperature: 0.7,
        }),
      })
    );

    const leads = JSON.parse(new TextDecoder().decode(response.body));
    return leads;
  }

  private async enrichLeads(
    leads: Partial<Lead>[],
    project: any
  ): Promise<Lead[]> {
    const enrichedLeads = await Promise.all(
      leads.map(async (lead) => {
        const prompt = `
Enrich this lead with additional information:

Lead:
- Name: ${lead.name}
- Company: ${lead.company || "Unknown"}
- Title: ${lead.title || "Unknown"}
- Industry: ${lead.industry || "Unknown"}
- Location: ${lead.location || "Unknown"}
- Website: ${lead.website || "Unknown"}

Project:
- Name: ${project.name}
- Description: ${project.description}
- Industry: ${project.industry || "Any"}

Find and add:
1. Company size
2. Company description
3. Social media profiles
4. Recent news/updates
5. Tech stack (if available)
6. Funding status (if available)

Format as JSON object.
`;

        const response = await this.bedrock.send(
          new InvokeModelCommand({
            modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
              prompt,
              max_tokens: 1000,
              temperature: 0.7,
            }),
          })
        );

        const enrichment = JSON.parse(new TextDecoder().decode(response.body));
        return {
          leadId: randomUUID(),
          projectId: project.projectId,
          ...lead,
          ...enrichment,
          score: 0,
          status: "new",
          source: "discovery",
          discoveredAt: new Date().toISOString(),
        } as Lead;
      })
    );

    return enrichedLeads;
  }

  private async scoreLeads(leads: Lead[], project: any): Promise<Lead[]> {
    const scoredLeads = await Promise.all(
      leads.map(async (lead) => {
        const prompt = `
Calculate a lead score (0-100) for this lead:

Lead:
- Name: ${lead.name}
- Company: ${lead.company || "Unknown"}
- Title: ${lead.title || "Unknown"}
- Industry: ${lead.industry || "Unknown"}
- Location: ${lead.location || "Unknown"}
- Website: ${lead.website || "Unknown"}
- Source: ${lead.source}

Project:
- Name: ${project.name}
- Description: ${project.description}
- Industry: ${project.industry || "Any"}

Consider:
1. Industry fit
2. Company size/relevance
3. Role seniority
4. Geographic location
5. Website quality
6. Source reliability

Return only the numerical score.
`;

        const response = await this.bedrock.send(
          new InvokeModelCommand({
            modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
              prompt,
              max_tokens: 100,
              temperature: 0.3,
            }),
          })
        );

        const score = parseInt(new TextDecoder().decode(response.body));
        return {
          ...lead,
          score: isNaN(score) ? 0 : Math.min(Math.max(score, 0), 100),
        };
      })
    );

    return scoredLeads;
  }

  private async getProject(projectId: string): Promise<any> {
    const response = await this.dynamodb.send(
      new GetItemCommand({
        TableName: this.projectsTableName,
        Key: marshall({ projectId }),
      })
    );

    return response.Item ? unmarshall(response.Item) : null;
  }

  private async storeLead(lead: Lead): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.leadsTableName,
        Item: marshall(lead),
      })
    );
  }
}
