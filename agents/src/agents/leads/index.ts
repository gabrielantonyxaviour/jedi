import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";
import { LeadScrapingService } from "./service";
import { wrapMetaLlamaPrompt } from "@/utils/helper";

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
    this.bedrock = new BedrockRuntimeClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.BEDROCK_AWS_KEY_ID!,
        secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.leadScraper = new LeadScrapingService();

    this.leadsTableName = process.env.LEADS_TABLE!;
    this.projectsTableName = process.env.PROJECTS_TABLE_NAME!;
    this.bucketName = process.env.LEAD_GENERATION_BUCKET!;
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
  }

  async processTask(task: any): Promise<void> {
    console.log(`🎯 Processing lead generation task: ${task.type}`);

    const characterInfo = task.characterInfo;
    let characterResponse = "";

    try {
      let result;

      switch (task.type) {
        case "DISCOVER_LEADS":
          const leads = await this.discoverLeads(task.payload);
          result = {
            leads,
            count: leads.length,
          };
          break;

        case "PROJECT_CREATED_LEADS_SEARCH":
          const newProjectLeads = await this.searchLeadsForNewProject(
            task.payload
          );
          // Auto-trigger email for high-scoring leads
          // for (const lead of newProjectLeads.filter((l) => l.score > 80)) {
          //   await this.triggerLeadEmail(lead);
          // }
          result = {
            leads: newProjectLeads,
            count: newProjectLeads.length,
          };
          break;

        // NEW TASK TYPES
        case "GET_LATEST_LEADS":
          const latestLeads = await this.getLatestLeads(task.payload);
          result = { latestLeads };
          break;

        case "GET_LEADS_BY_SOURCE":
          const leadsBySource = await this.getLeadsBySource(task.payload);
          result = { leadsBySource };
          break;

        case "SCORE_LEADS":
          const scoredLeads = await this.scoreLeads(task.payload);
          result = { scoredLeads };
          break;

        case "QUALIFY_LEAD":
          const qualification = await this.qualifyLead(task.payload);
          result = { qualification };
          break;

        case "GENERATE_OUTREACH":
          const outreach = await this.generateOutreachContent(task.payload);
          result = { outreach };
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      if (characterInfo?.agentCharacter) {
        if (characterInfo.side === "light") {
          characterResponse =
            "*Wookiee growls of satisfaction* Found excellent opportunities, I have! Loyal hunting for leads, my specialty it is.";
        } else {
          characterResponse =
            "Elegant business solutions, I provide. Power and precision, my methods are. The dark side of networking, strong it is.";
        }
      }

      await this.reportTaskCompletion(task.taskId, task.workflowId, {
        ...result,
        characterResponse,
      });
    } catch (error: any) {
      if (characterInfo?.agentCharacter) {
        characterResponse =
          characterInfo.side === "light"
            ? "*frustrated Wookiee sounds* Failed to find good leads, I have. Try harder, I must."
            : "This incompetence is beneath me. The Count demands better results. Disappointing, most disappointing.";
      }

      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        null,
        error.message,
        characterResponse
      );
      throw error;
    }
  }

  // NEW METHODS
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

  // EXISTING METHODS (unchanged)
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
    let searchKeywords;
    try {
      searchKeywords = await this.generateSearchKeywords(project);
      console.log(`📝 Generated keywords:`, searchKeywords);
    } catch (error) {
      console.error("Error generating keywords:", error);
      searchKeywords = [project.name, "business"];
    }

    // Use the working scraper
    const discoveredLeads = await this.leadScraper.scrapeLeads(
      project,
      payload.sources || ["all"],
      payload.maxResults || 50
    );

    console.log("🔍 Discovered leads:", discoveredLeads);

    await this.storeLeadsInProject(payload.projectId, discoveredLeads);

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
  
  IMPORTANT: Return ONLY a valid JSON array of strings. No explanations, no additional text.
  Example format: ["keyword1", "keyword2", "keyword3"]
  `;

    try {
      const response = await this.bedrock.send(
        new InvokeModelCommand({
          modelId: "meta.llama3-70b-instruct-v1:0",
          body: JSON.stringify({
            prompt: wrapMetaLlamaPrompt(prompt),
            max_gen_len: 200,
            temperature: 0.3,
            top_p: 0.9,
          }),
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.body));
      let generation = result.generation.trim();

      // Clean up the response - extract JSON if wrapped in text
      const jsonMatch = generation.match(/\[.*\]/s);
      if (jsonMatch) {
        generation = jsonMatch[0];
      }

      const keywords = JSON.parse(generation);
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
      scoredLeads.push(updatedLead);
    }

    await this.storeLeadsInProject(payload.projectId, scoredLeads);

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
        modelId: "meta.llama3-70b-instruct-v1:0",
        body: JSON.stringify({
          prompt: wrapMetaLlamaPrompt(prompt),
          max_gen_len: 800,
          temperature: 0.5,
          top_p: 0.9,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const qualification = JSON.parse(result.generation);

    // Update lead with qualification
    await this.updateLead(lead.projectId, {
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
        modelId: "meta.llama3-70b-instruct-v1:0",
        body: JSON.stringify({
          prompt: wrapMetaLlamaPrompt(prompt),
          max_gen_len: 600,
          temperature: 0.5,
          top_p: 0.9,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const outreachContent = result.generation;

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
        modelId: "meta.llama3-70b-instruct-v1:0",
        body: JSON.stringify({
          prompt: wrapMetaLlamaPrompt(prompt),
          max_gen_len: 50,
          temperature: 0.5,
          top_p: 0.9,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const scoreText = result.generation;
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

  private calculateSources(
    leads: Lead[]
  ): Array<{ source: string; count: number }> {
    const sourceMap = new Map();
    leads.forEach((lead) => {
      const count = sourceMap.get(lead.source) || 0;
      sourceMap.set(lead.source, count + 1);
    });

    return Array.from(sourceMap.entries()).map(([source, count]) => ({
      source,
      count,
    }));
  }

  private async storeLeadsInProject(
    projectId: string,
    leads: Lead[]
  ): Promise<void> {
    const project = await this.getProject(projectId);

    const updatedLeads = {
      isActive: true,
      totalLeads: leads.length,
      sources: this.calculateSources(leads),
      leads: leads,
      lastScanAt: new Date().toISOString(),
      highValueLeads: leads.filter((l) => l.score > 80).length,
    };

    await this.dynamodb.send(
      new UpdateItemCommand({
        TableName: this.projectsTableName,
        Key: marshall({ projectId }, { removeUndefinedValues: true }),
        UpdateExpression: "SET leads = :leads, updatedAt = :updatedAt",
        ExpressionAttributeValues: marshall(
          {
            ":leads": updatedLeads,
            ":updatedAt": new Date().toISOString(),
          },
          { removeUndefinedValues: true }
        ),
      })
    );
  }

  private async getProjectLeads(projectId: string): Promise<Lead[]> {
    const project = await this.getProject(projectId);
    return project?.leads?.leads || [];
  }

  private async addLeadToProject(
    projectId: string,
    newLead: Lead
  ): Promise<void> {
    const project = await this.getProject(projectId);
    const existingLeads = project?.leads?.leads || [];

    // Avoid duplicates
    if (!existingLeads.find((l: Lead) => l.leadId === newLead.leadId)) {
      existingLeads.push(newLead);
      await this.storeLeadsInProject(projectId, existingLeads);
    }
  }

  private async updateLead(projectId: string, lead: Lead): Promise<void> {
    await this.addLeadToProject(projectId, lead);
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string,
    characterResponse?: string
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
              result: result ? { ...result, characterResponse } : null,
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
