// src/agents/lead-generation.ts
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  OpenSearchClient,
  SearchCommand,
  IndexCommand,
} from "@aws-sdk/client-opensearch";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";

interface Lead {
  leadId: string;
  projectId: string;
  name: string;
  email?: string;
  company?: string;
  title?: string;
  linkedinUrl?: string;
  twitterHandle?: string;
  score: number;
  status: "new" | "contacted" | "qualified" | "converted" | "rejected";
  source: string;
  discoveredAt: string;
  lastContactedAt?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export class LeadsAgent {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private bedrock: BedrockRuntimeClient;
  private sqs: SQSClient;
  private opensearch: OpenSearchClient;
  private leadsTableName: string;
  private projectsTableName: string;
  private bucketName: string;
  private orchestratorQueue: string;
  private opensearchEndpoint: string;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.opensearch = new OpenSearchClient({ region: process.env.AWS_REGION });

    this.leadsTableName = process.env.LEADS_TABLE!;
    this.projectsTableName = process.env.PROJECTS_TABLE_NAME!;
    this.bucketName = process.env.LEAD_GENERATION_BUCKET!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
    this.opensearchEndpoint = process.env.OPENSEARCH_ENDPOINT!;
  }

  async processTask(task: any): Promise<void> {
    console.log(`🎯 Processing lead generation task: ${task.type}`);

    try {
      switch (task.type) {
        case "DISCOVER_LEADS":
          const leads = await this.discoverLeads(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            leads,
          });
          break;

        case "SCORE_LEADS":
          const scoredLeads = await this.scoreLeads(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            scoredLeads,
          });
          break;

        case "QUALIFY_LEAD":
          const qualification = await this.qualifyLead(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            qualification,
          });
          break;

        case "GENERATE_OUTREACH":
          const outreach = await this.generateOutreachContent(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            outreach,
          });
          break;
      }
    } catch (error: any) {
      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        null,
        error.message
      );
      throw error;
    }
  }

  async discoverLeads(payload: {
    projectId: string;
    criteria: any;
    sources: string[];
  }): Promise<Lead[]> {
    const project = await this.getProject(payload.projectId);
    const discoveredLeads: Lead[] = [];

    // Search through different sources
    for (const source of payload.sources) {
      switch (source) {
        case "linkedin":
          const linkedinLeads = await this.searchLinkedIn(
            project,
            payload.criteria
          );
          discoveredLeads.push(...linkedinLeads);
          break;

        case "github":
          const githubLeads = await this.searchGitHub(
            project,
            payload.criteria
          );
          discoveredLeads.push(...githubLeads);
          break;

        case "twitter":
          const twitterLeads = await this.searchTwitter(
            project,
            payload.criteria
          );
          discoveredLeads.push(...twitterLeads);
          break;
      }
    }

    // Store and index leads
    for (const lead of discoveredLeads) {
      await this.storeLead(lead);
      await this.indexLead(lead);
    }

    return discoveredLeads;
  }

  async scoreLeads(payload: {
    projectId: string;
    leadIds?: string[];
  }): Promise<Lead[]> {
    let leads: Lead[];

    if (payload.leadIds) {
      leads = await Promise.all(payload.leadIds.map((id) => this.getLead(id)));
    } else {
      leads = await this.getProjectLeads(payload.projectId);
    }

    const project = await this.getProject(payload.projectId);
    const scoredLeads: Lead[] = [];

    for (const lead of leads) {
      const score = await this.calculateLeadScore(lead, project);
      const updatedLead = { ...lead, score };

      await this.updateLead(updatedLead);
      scoredLeads.push(updatedLead);
    }

    return scoredLeads;
  }

  async qualifyLead(payload: { leadId: string }): Promise<any> {
    const lead = await this.getLead(payload.leadId);
    const project = await this.getProject(lead.projectId);

    const prompt = `
   Analyze this lead for qualification:
   
   Lead Information:
   - Name: ${lead.name}
   - Company: ${lead.company || "Unknown"}
   - Title: ${lead.title || "Unknown"}
   - Email: ${lead.email || "Not available"}
   - LinkedIn: ${lead.linkedinUrl || "Not available"}
   - Source: ${lead.source}
   
   Project Context:
   - Project: ${project.name}
   - Description: ${project.description}
   
   Analyze this lead and provide:
   1. Qualification status (High/Medium/Low potential)
   2. Reasoning for the qualification
   3. Recommended next steps
   4. Potential value/fit score (1-10)
   5. Suggested outreach approach
   
   Format as JSON with fields: qualification, reasoning, nextSteps, valueScore, outreachApproach
      `;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 800,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const qualification = JSON.parse(result.content[0].text);

    // Update lead with qualification
    await this.updateLead({
      ...lead,
      status:
        qualification.qualification === "High potential" ? "qualified" : "new",
      metadata: { ...lead.metadata, qualification },
    });

    return qualification;
  }

  async generateOutreachContent(payload: {
    leadId: string;
    outreachType: "email" | "linkedin" | "twitter";
  }): Promise<any> {
    const lead = await this.getLead(payload.leadId);
    const project = await this.getProject(lead.projectId);

    const prompt = `
   Generate personalized outreach content for this lead:
   
   Lead: ${lead.name} at ${lead.company || "their company"}
   Title: ${lead.title || "Professional"}
   Source: ${lead.source}
   
   Project: ${project.name}
   Description: ${project.description}
   
   Outreach Type: ${payload.outreachType}
   
   Create a personalized ${payload.outreachType} message that:
   - Is professional and engaging
   - References their background/company if available
   - Clearly explains the value proposition
   - Has a clear call-to-action
   - Is appropriate for ${payload.outreachType} format
   - Feels personal, not templated
   
   Return only the message content.
      `;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 600,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const outreachContent = result.content[0].text;

    // Store outreach content
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `outreach/${lead.leadId}/${
          payload.outreachType
        }_${Date.now()}.txt`,
        Body: outreachContent,
        ContentType: "text/plain",
      })
    );

    return {
      leadId: lead.leadId,
      outreachType: payload.outreachType,
      content: outreachContent,
      generatedAt: new Date().toISOString(),
    };
  }

  private async searchLinkedIn(project: any, criteria: any): Promise<Lead[]> {
    // TODO: Implement LinkedIn search using LinkedIn API or web scraping
    // For now, return mock data
    console.log(
      `🔍 Searching LinkedIn for leads matching: ${JSON.stringify(criteria)}`
    );

    return [
      {
        leadId: randomUUID(),
        projectId: project.projectId,
        name: "Sample LinkedIn Lead",
        company: "Tech Company",
        title: "CTO",
        linkedinUrl: "https://linkedin.com/in/sample",
        score: 0,
        status: "new",
        source: "linkedin",
        discoveredAt: new Date().toISOString(),
      },
    ];
  }

  private async searchGitHub(project: any, criteria: any): Promise<Lead[]> {
    // TODO: Implement GitHub search for developers/contributors
    console.log(
      `🔍 Searching GitHub for leads matching: ${JSON.stringify(criteria)}`
    );

    return [
      {
        leadId: randomUUID(),
        projectId: project.projectId,
        name: "Sample GitHub Developer",
        company: "Open Source Contributor",
        title: "Software Engineer",
        score: 0,
        status: "new",
        source: "github",
        discoveredAt: new Date().toISOString(),
      },
    ];
  }

  private async searchTwitter(project: any, criteria: any): Promise<Lead[]> {
    // TODO: Implement Twitter search using Twitter API
    console.log(
      `🔍 Searching Twitter for leads matching: ${JSON.stringify(criteria)}`
    );

    return [
      {
        leadId: randomUUID(),
        projectId: project.projectId,
        name: "Sample Twitter User",
        twitterHandle: "@sample_user",
        score: 0,
        status: "new",
        source: "twitter",
        discoveredAt: new Date().toISOString(),
      },
    ];
  }

  private async calculateLeadScore(lead: Lead, project: any): Promise<number> {
    const prompt = `
   Score this lead for the given project (0-100):
   
   Lead:
   - Name: ${lead.name}
   - Company: ${lead.company || "Unknown"}
   - Title: ${lead.title || "Unknown"}
   - Source: ${lead.source}
   
   Project:
   - Name: ${project.name}
   - Description: ${project.description}
   
   Consider factors like:
   - Title relevance to project
   - Company size/type
   - Source quality
   - Potential influence
   - Likelihood to engage
   
   Return only a number between 0-100.
      `;

    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 50,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const scoreText = result.content[0].text.trim();
    const score = parseInt(scoreText.match(/\d+/)?.[0] || "50");

    return Math.max(0, Math.min(100, score));
  }

  private async getProject(projectId: string): Promise<any> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.projectsTableName,
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({ ":projectId": projectId }),
      })
    );

    return response.Items ? unmarshall(response.Items[0]) : null;
  }

  private async getLead(leadId: string): Promise<Lead> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.leadsTableName,
        KeyConditionExpression: "leadId = :leadId",
        ExpressionAttributeValues: marshall({ ":leadId": leadId }),
      })
    );

    return response.Items ? (unmarshall(response.Items[0]) as Lead) : null!;
  }

  private async getProjectLeads(projectId: string): Promise<Lead[]> {
    const response = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.leadsTableName,
        IndexName: "projectId-score-index",
        KeyConditionExpression: "projectId = :projectId",
        ExpressionAttributeValues: marshall({ ":projectId": projectId }),
      })
    );

    return (response.Items || []).map((item) => unmarshall(item) as Lead);
  }

  private async storeLead(lead: Lead): Promise<void> {
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.leadsTableName,
        Item: marshall(lead),
      })
    );
  }

  private async updateLead(lead: Lead): Promise<void> {
    await this.storeLead(lead);
  }

  private async indexLead(lead: Lead): Promise<void> {
    // TODO: Index in OpenSearch for advanced searching
    console.log(`📇 Indexing lead ${lead.name} in OpenSearch`);
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string
  ) {
    try {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: this.orchestratorQueue,
          MessageBody: JSON.stringify({
            type: "TASK_COMPLETION",
            payload: {
              taskId,
              workflowId,
              status: error ? "FAILED" : "COMPLETED",
              result,
              error,
              timestamp: new Date().toISOString(),
              agent: "lead-generation",
            },
          }),
        })
      );
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}
