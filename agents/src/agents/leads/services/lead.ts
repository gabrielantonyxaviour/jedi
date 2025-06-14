import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";

export interface Lead {
  leadId: string;
  projectId: string;
  name: string;
  email?: string;
  company?: string;
  title?: string;
  website?: string;
  industry?: string;
  location?: string;
  score: number;
  status: "new" | "contacted" | "qualified" | "converted" | "rejected";
  source: string;
  discoveredAt: string;
  lastContactedAt?: string;
  notes?: string;
  metadata?: Record<string, any>;
  matchReason?: string;
}

export class LeadService {
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

  async getLatestLeads(payload: {
    projectId: string;
    limit?: number;
  }): Promise<Lead[]> {
    console.log(`📋 Getting latest leads for project: ${payload.projectId}`);

    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.leadsTableName,
        IndexName: "projectId-discoveredAt-index",
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({
          ":projectId": payload.projectId,
        }),
        ScanIndexForward: false, // Sort by discoveredAt descending
        Limit: payload.limit || 20,
      })
    );

    return (response.Items || []).map((item) => unmarshall(item) as Lead);
  }

  async getLeadsBySource(payload: {
    projectId: string;
    source: string;
  }): Promise<Lead[]> {
    console.log(
      `🔍 Getting leads by source: ${payload.source} for project: ${payload.projectId}`
    );

    const allLeads = await this.getProjectLeads(payload.projectId);
    return allLeads.filter((lead) => lead.source === payload.source);
  }

  async scoreLeads(payload: {
    projectId: string;
    leadIds?: string[];
  }): Promise<Lead[]> {
    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const leads = payload.leadIds
      ? await Promise.all(payload.leadIds.map((id) => this.getLead(id)))
      : await this.getProjectLeads(payload.projectId);

    const scoredLeads = await Promise.all(
      leads.map(async (lead) => {
        const score = await this.calculateLeadScore(lead, project);
        const updatedLead = { ...lead, score };
        await this.updateLead(updatedLead);
        return updatedLead;
      })
    );

    return scoredLeads;
  }

  async qualifyLead(payload: { leadId: string }): Promise<any> {
    const lead = await this.getLead(payload.leadId);
    if (!lead) {
      throw new Error(`Lead not found: ${payload.leadId}`);
    }

    const project = await this.getProject(lead.projectId);
    if (!project) {
      throw new Error(`Project not found: ${lead.projectId}`);
    }

    // Generate qualification analysis using Bedrock
    const prompt = `
Analyze this lead for qualification:

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

Provide a detailed analysis including:
1. Fit score (0-100)
2. Key strengths
3. Potential challenges
4. Recommended next steps
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

    const analysis = JSON.parse(new TextDecoder().decode(response.body));
    return analysis;
  }

  async generateOutreachContent(payload: {
    leadId: string;
    outreachType: "email" | "linkedin" | "cold_call";
  }): Promise<any> {
    const lead = await this.getLead(payload.leadId);
    if (!lead) {
      throw new Error(`Lead not found: ${payload.leadId}`);
    }

    const project = await this.getProject(lead.projectId);
    if (!project) {
      throw new Error(`Project not found: ${lead.projectId}`);
    }

    const prompt = `
Generate ${payload.outreachType} outreach content for this lead:

Lead:
- Name: ${lead.name}
- Company: ${lead.company || "Unknown"}
- Title: ${lead.title || "Unknown"}
- Industry: ${lead.industry || "Unknown"}
- Location: ${lead.location || "Unknown"}

Project:
- Name: ${project.name}
- Description: ${project.description}
- Industry: ${project.industry || "Any"}

Generate personalized content that:
1. Shows understanding of their business
2. Highlights relevant project benefits
3. Includes a clear call to action
4. Maintains a professional yet engaging tone
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

    const content = JSON.parse(new TextDecoder().decode(response.body));
    return content;
  }

  async storeLead(lead: Lead): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.leadsTableName,
        Item: marshall(lead),
      })
    );
  }

  async updateLead(lead: Lead): Promise<void> {
    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: this.leadsTableName,
        Key: marshall({ leadId: lead.leadId }),
        UpdateExpression:
          "SET #status = :status, #score = :score, #lastContactedAt = :lastContactedAt, #notes = :notes, #metadata = :metadata",
        ExpressionAttributeNames: {
          "#status": "status",
          "#score": "score",
          "#lastContactedAt": "lastContactedAt",
          "#notes": "notes",
          "#metadata": "metadata",
        },
        ExpressionAttributeValues: marshall({
          ":status": lead.status,
          ":score": lead.score,
          ":lastContactedAt": lead.lastContactedAt,
          ":notes": lead.notes,
          ":metadata": lead.metadata,
        }),
      })
    );
  }

  private async calculateLeadScore(lead: Lead, project: any): Promise<number> {
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
    return isNaN(score) ? 0 : Math.min(Math.max(score, 0), 100);
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

  private async getLead(leadId: string): Promise<Lead> {
    const response = await this.dynamodb.send(
      new GetItemCommand({
        TableName: this.leadsTableName,
        Key: marshall({ leadId }),
      })
    );

    if (!response.Item) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    return unmarshall(response.Item) as Lead;
  }

  private async getProjectLeads(projectId: string): Promise<Lead[]> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.leadsTableName,
        IndexName: "projectId-discoveredAt-index",
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({
          ":projectId": projectId,
        }),
      })
    );

    return (response.Items || []).map((item) => unmarshall(item) as Lead);
  }
}
