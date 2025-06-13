import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";
import { LeadScrapingService } from "../services/lead-scraper";

interface Lead {
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

export class LeadsAgent {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private bedrock: BedrockRuntimeClient;
  private sqs: SQSClient;
  private leadScraper: LeadScrapingService;
  private leadsTableName: string;
  private projectsTableName: string;
  private bucketName: string;
  private orchestratorQueue: string;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.leadScraper = new LeadScrapingService();

    this.leadsTableName = process.env.LEADS_TABLE!;
    this.projectsTableName = process.env.PROJECTS_TABLE_NAME!;
    this.bucketName = process.env.LEAD_GENERATION_BUCKET!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
  }

  async processTask(task: any): Promise<void> {
    console.log(`🎯 Processing lead generation task: ${task.type}`);

    try {
      switch (task.type) {
        case "DISCOVER_LEADS":
          const leads = await this.discoverLeads(task.payload);
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            leads,
            count: leads.length,
          });
          break;

        case "PROJECT_CREATED_LEADS_SEARCH":
          const newProjectLeads = await this.searchLeadsForNewProject(
            task.payload
          );
          // Auto-trigger email for high-scoring leads
          for (const lead of newProjectLeads.filter((l) => l.score > 80)) {
            await this.triggerLeadEmail(lead);
          }
          await this.reportTaskCompletion(task.taskId, task.workflowId, {
            leads: newProjectLeads,
            count: newProjectLeads.length,
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

        default:
          throw new Error(`Unknown task type: ${task.type}`);
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

  async searchLeadsForNewProject(payload: {
    projectId: string;
    projectName: string;
    description: string;
    industry?: string;
    keywords?: string[];
    sources?: string[];
    maxResults?: number;
  }): Promise<Lead[]> {
    console.log(
      `🔍 Starting lead search for new project: ${payload.projectName}`
    );

    return await this.discoverLeads({
      projectId: payload.projectId,
      sources: payload.sources || ["all"],
      maxResults: payload.maxResults || 50,
    });
  }

  async discoverLeads(payload: {
    projectId: string;
    sources?: string[];
    maxResults?: number;
  }): Promise<Lead[]> {
    const project = await this.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    console.log(`🎯 Discovering leads for project: ${project.name}`);

    // Generate search keywords using Bedrock
    const searchKeywords = await this.generateSearchKeywords(project);
    console.log(`📝 Generated keywords:`, searchKeywords);

    // Use the working scraper
    const discoveredLeads = await this.leadScraper.scrapeLeads(
      project,
      payload.sources || ["all"],
      payload.maxResults || 50
    );

    // Store all leads in DynamoDB
    for (const lead of discoveredLeads) {
      await this.storeLead(lead);
    }

    console.log(`✅ Discovered and stored ${discoveredLeads.length} leads`);
    return discoveredLeads;
  }

  private async generateSearchKeywords(project: any): Promise<string[]> {
    const prompt = `
Generate search keywords for finding business leads for this project:

Project: ${project.name}
Description: ${project.description}
Industry: ${project.industry || "Any"}

Generate 5-10 relevant keywords that would help find:
1. Potential clients who might need this solution
2. Companies in related industries  
3. Business partners or collaborators
4. Competitors or similar products

Return as a JSON array of strings, e.g. ["keyword1", "keyword2", "keyword3"]
Focus on specific, actionable terms rather than generic ones.
`;

    try {
      const response = await this.bedrock.send(
        new InvokeModelCommand({
          modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
          body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 300,
          }),
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.body));
      const keywords = JSON.parse(result.content[0].text);

      return Array.isArray(keywords) ? keywords : [project.name];
    } catch (error) {
      console.error("Error generating keywords:", error);
      // Fallback to basic keywords
      return [project.name, project.industry || "business"].filter(Boolean);
    }
  }

  private async triggerLeadEmail(lead: Lead): Promise<void> {
    console.log(`📧 Triggering email for high-scoring lead: ${lead.name}`);

    const project = await this.getProject(lead.projectId);

    try {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: process.env.EMAIL_QUEUE_URL!,
          MessageBody: JSON.stringify({
            type: "LEAD_OPPORTUNITY",
            taskId: randomUUID(),
            workflowId: randomUUID(),
            payload: {
              userEmail: project.email,
              userName: project.userName,
              projectName: project.name,
              lead: {
                company: lead.company,
                contactName: lead.name,
                contactEmail: lead.email,
                industry: lead.industry,
                opportunity: "Business opportunity",
                value: "High potential",
                source: lead.source,
                confidence: lead.score,
                nextSteps: [
                  "Research the company further",
                  "Prepare personalized outreach message",
                  "Connect via email or LinkedIn",
                  "Schedule discovery call if interested",
                ],
              },
            },
          }),
        })
      );

      console.log(`✅ Lead email triggered for ${lead.name}`);
    } catch (error) {
      console.error("Failed to trigger lead email:", error);
    }
  }

  // Keep existing methods for scoring, qualifying, and outreach generation
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
- Industry: ${lead.industry || "Unknown"}
- Website: ${lead.website || "Not available"}
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
    outreachType: "email" | "linkedin" | "cold_call";
  }): Promise<any> {
    const lead = await this.getLead(payload.leadId);
    const project = await this.getProject(lead.projectId);

    const prompt = `
Generate personalized outreach content for this business lead:

Lead: ${lead.name} at ${lead.company || "their company"}
Title: ${lead.title || "Business Professional"}
Industry: ${lead.industry || "Unknown"}
Source: ${lead.source}

Project: ${project.name}
Description: ${project.description}

Outreach Type: ${payload.outreachType}

Create a personalized ${payload.outreachType} message that:
- Is professional and business-focused
- References their company/industry if available
- Clearly explains the business value proposition
- Has a clear call-to-action for business discussion
- Is appropriate for ${payload.outreachType} format
- Feels personal and researched, not templated

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

  private async calculateLeadScore(lead: Lead, project: any): Promise<number> {
    const prompt = `
Score this business lead for the given project (0-100):

Lead:
- Name: ${lead.name}
- Company: ${lead.company || "Unknown"}
- Title: ${lead.title || "Unknown"}
- Industry: ${lead.industry || "Unknown"}
- Source: ${lead.source}

Project:
- Name: ${project.name}
- Description: ${project.description}

Consider factors like:
- Industry relevance to project
- Company size/potential budget
- Title/decision-making authority
- Source quality and relevance
- Potential business value
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

  // Helper methods
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
