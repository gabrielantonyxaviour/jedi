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
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "crypto";
import { Client } from "@opensearch-project/opensearch";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";

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

interface LeadOpportunity {
  type: "partnership" | "client" | "investor" | "collaborator";
  description: string;
  potentialValue: string;
  confidence: number;
}

export class LeadsAgent {
  private dynamodb: DynamoDBClient;
  private s3: S3Client;
  private bedrock: BedrockRuntimeClient;
  private sqs: SQSClient;
  private opensearch: Client;
  private leadsTableName: string;
  private projectsTableName: string;
  private bucketName: string;
  private orchestratorQueue: string;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.s3 = new S3Client({ region: process.env.AWS_REGION });
    this.bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });

    // Initialize OpenSearch client with AWS auth
    this.opensearch = new Client({
      ...AwsSigv4Signer({
        region: process.env.AWS_REGION!,
        service: "es",
        getCredentials: () => defaultProvider()(),
      }),
      node: process.env.OPENSEARCH_ENDPOINT!,
    });

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
  }): Promise<Lead[]> {
    console.log(
      `🔍 Starting lead search for new project: ${payload.projectName}`
    );

    const searchCriteria = {
      projectKeywords: payload.keywords || [],
      industry: payload.industry,
      description: payload.description,
    };

    return await this.discoverLeads({
      projectId: payload.projectId,
      criteria: searchCriteria,
      sources: ["business_directory", "company_database", "industry_contacts"],
    });
  }

  async discoverLeads(payload: {
    projectId: string;
    criteria: any;
    sources: string[];
  }): Promise<Lead[]> {
    const project = await this.getProject(payload.projectId);
    const discoveredLeads: Lead[] = [];

    // Search OpenSearch for potential leads
    const searchQuery = await this.buildSearchQuery(project, payload.criteria);
    const searchResults = await this.searchOpenSearch(searchQuery);

    // Process search results into leads
    for (const result of searchResults) {
      const lead = await this.processSearchResult(result, project);
      if (lead) {
        discoveredLeads.push(lead);
        await this.storeLead(lead);
        await this.indexLead(lead);
      }
    }

    return discoveredLeads;
  }

  private async buildSearchQuery(project: any, criteria: any): Promise<any> {
    // Extract keywords from project description
    const prompt = `
Extract search keywords for finding business leads for this project:

Project: ${project.name}
Description: ${project.description}
Industry: ${criteria.industry || "Any"}

Generate search terms that would help find:
1. Potential clients who might need this solution
2. Companies in related industries
3. Business partners or collaborators
4. Investors interested in this space

Return as JSON with arrays: clientKeywords, partnerKeywords, investorKeywords, industryTerms
`;

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

    // Build OpenSearch query
    return {
      index: "business_leads",
      body: {
        size: 50,
        query: {
          bool: {
            should: [
              {
                multi_match: {
                  query: keywords.clientKeywords.join(" "),
                  fields: ["company_description", "industry", "services"],
                  boost: 3,
                },
              },
              {
                multi_match: {
                  query: keywords.partnerKeywords.join(" "),
                  fields: [
                    "company_description",
                    "technologies",
                    "focus_areas",
                  ],
                  boost: 2,
                },
              },
              {
                multi_match: {
                  query: keywords.investorKeywords.join(" "),
                  fields: [
                    "investment_focus",
                    "portfolio_companies",
                    "sectors",
                  ],
                  boost: 2,
                },
              },
              {
                terms: {
                  industry: keywords.industryTerms,
                  boost: 1.5,
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
        sort: [{ _score: { order: "desc" } }],
      },
    };
  }

  private async searchOpenSearch(query: any): Promise<any[]> {
    try {
      const response = await this.opensearch.search(query);
      return response.body.hits.hits.map((hit: any) => ({
        score: hit._score,
        source: hit._source,
      }));
    } catch (error) {
      console.error("OpenSearch error:", error);
      return [];
    }
  }

  private async processSearchResult(
    result: any,
    project: any
  ): Promise<Lead | null> {
    const source = result.source;

    // Analyze if this is a good lead
    const analysis = await this.analyzeLeadPotential(source, project);

    if (analysis.confidence < 60) {
      return null; // Skip low-confidence leads
    }

    const lead: Lead = {
      leadId: randomUUID(),
      projectId: project.projectId,
      name: source.contact_name || source.company_name || "Unknown",
      email: source.email,
      company: source.company_name,
      title: source.title || source.position,
      website: source.website,
      industry: source.industry,
      location: source.location,
      score: Math.round(result.score * 10), // Convert relevance to 0-100 scale
      status: "new",
      source: "opensearch_business_directory",
      discoveredAt: new Date().toISOString(),
      matchReason: analysis.reason,
      metadata: {
        opportunity: analysis.opportunity,
        searchScore: result.score,
        confidence: analysis.confidence,
      },
    };

    return lead;
  }

  private async analyzeLeadPotential(
    leadData: any,
    project: any
  ): Promise<{
    confidence: number;
    reason: string;
    opportunity: LeadOpportunity;
  }> {
    const prompt = `
Analyze this potential business lead for the given project:

Lead Information:
- Company: ${leadData.company_name || "Unknown"}
- Industry: ${leadData.industry || "Unknown"}
- Description: ${leadData.company_description || "No description"}
- Services: ${leadData.services || "Unknown"}
- Size: ${leadData.company_size || "Unknown"}
- Location: ${leadData.location || "Unknown"}

Project:
- Name: ${project.name}
- Description: ${project.description}

Analyze and determine:
1. Confidence level (0-100) that this is a valuable lead
2. Type of opportunity (partnership, client, investor, collaborator)
3. Reason for the match
4. Potential value description
5. Brief opportunity description

Respond in JSON format:
{
  "confidence": 85,
  "reason": "Strong industry alignment and complementary services",
  "opportunity": {
    "type": "client",
    "description": "Potential client for project services",
    "potentialValue": "High-value enterprise client",
    "confidence": 85
  }
}
`;

    try {
      const response = await this.bedrock.send(
        new InvokeModelCommand({
          modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
          body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 400,
          }),
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.body));
      return JSON.parse(result.content[0].text);
    } catch (error) {
      console.error("Error analyzing lead potential:", error);
      return {
        confidence: 50,
        reason: "Error in analysis",
        opportunity: {
          type: "client",
          description: "Potential opportunity",
          potentialValue: "Unknown",
          confidence: 50,
        },
      };
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
                opportunity:
                  lead.metadata?.opportunity?.description ||
                  "Business opportunity",
                value:
                  lead.metadata?.opportunity?.potentialValue ||
                  "High potential",
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
- Match Reason: ${lead.matchReason || "N/A"}

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
Match Reason: ${lead.matchReason || "Business opportunity"}

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

  // ... rest of the helper methods remain the same
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
    try {
      await this.opensearch.index({
        index: "leads",
        id: lead.leadId,
        body: {
          ...lead,
          searchableText: `${lead.name} ${lead.company} ${lead.title} ${lead.industry}`,
        },
      });
      console.log(`📇 Indexed lead ${lead.name} in OpenSearch`);
    } catch (error) {
      console.error("Failed to index lead:", error);
    }
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
