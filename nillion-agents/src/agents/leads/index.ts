import { randomUUID } from "crypto";
import OpenAI from "openai";
import { LeadScrapingService } from "./service";
import {
  pushLeads,
  fetchLeads,
  fetchLeadsByAddress,
  pushLogs,
} from "../../services/nillion";
import { LeadsData, LogsData } from "../../types/nillion";

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
  private openai: OpenAI;
  private leadScraper: LeadScrapingService;
  private agentName: string = "leads-agent";

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.MY_OPENAI_KEY,
    });
    this.leadScraper = new LeadScrapingService();
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
          for (const lead of newProjectLeads.filter((l) => l.score > 80)) {
            await this.triggerLeadEmail(lead, task.payload.ownerAddress);
          }

          result = {
            leads: newProjectLeads,
            count: newProjectLeads.length,
          };
          break;

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

      // Generate character response
      if (characterInfo?.agentCharacter) {
        if (characterInfo.side === "light") {
          characterResponse =
            "*Wookiee growls of satisfaction* Found excellent opportunities, I have! Loyal hunting for leads, my specialty it is.";
        } else {
          characterResponse =
            "Elegant business solutions, I provide. Power and precision, my methods are. The dark side of networking, strong it is.";
        }
      }

      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        task.payload.ownerAddress || "system",
        {
          ...result,
          characterResponse,
        }
      );
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
        task.payload.ownerAddress || "system",
        null,
        error.message,
        characterResponse
      );
      throw error;
    }
  }

  async getLatestLeads(payload: {
    projectId: string;
    ownerAddress: string;
    limit?: number;
  }): Promise<Lead[]> {
    console.log(`📋 Getting latest leads for project: ${payload.projectId}`);

    const allLeads = await fetchLeadsByAddress(payload.ownerAddress);
    const projectLeads = allLeads
      .filter((lead) => lead.project_id === payload.projectId)
      .map(this.mapLeadsDataToLead)
      .sort(
        (a, b) =>
          new Date(b.discoveredAt).getTime() -
          new Date(a.discoveredAt).getTime()
      )
      .slice(0, payload.limit || 20);

    // Log the fetch operation
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      agent_name: this.agentName,
      text: `Fetched ${projectLeads.length} latest leads`,
      data: JSON.stringify({
        type: "LATEST_LEADS_FETCH",
        projectId: payload.projectId,
        count: projectLeads.length,
        timestamp: new Date().toISOString(),
      }),
    });

    return projectLeads;
  }

  async getLeadsBySource(payload: {
    projectId: string;
    source: string;
    ownerAddress: string;
  }): Promise<Lead[]> {
    console.log(
      `🔍 Getting leads by source: ${payload.source} for project: ${payload.projectId}`
    );

    const allLeads = await this.getProjectLeads(
      payload.projectId,
      payload.ownerAddress
    );
    const sourceLeads = allLeads.filter(
      (lead) => lead.source === payload.source
    );

    // Log the fetch operation
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      agent_name: this.agentName,
      text: `Fetched ${sourceLeads.length} leads from source: ${payload.source}`,
      data: JSON.stringify({
        type: "LEADS_BY_SOURCE_FETCH",
        projectId: payload.projectId,
        source: payload.source,
        count: sourceLeads.length,
        timestamp: new Date().toISOString(),
      }),
    });

    return sourceLeads;
  }

  async searchLeadsForNewProject(payload: {
    projectId: string;
    projectName: string;
    description: string;
    ownerAddress: string;
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
      ownerAddress: payload.ownerAddress,
      sources: payload.sources || ["all"],
      maxResults: payload.maxResults || 50,
    });
  }

  async discoverLeads(payload: {
    projectId: string;
    ownerAddress: string;
    sources?: string[];
    maxResults?: number;
  }): Promise<Lead[]> {
    // Get project info from existing leads data or use defaults
    const existingLeads = await fetchLeadsByAddress(payload.ownerAddress);
    const projectLead = existingLeads.find(
      (l) => l.project_id === payload.projectId
    );

    const project = projectLead
      ? {
          projectId: payload.projectId,
          name: projectLead.name,
          description: projectLead.desc,
        }
      : {
          projectId: payload.projectId,
          name: "Project",
          description: "Lead generation project",
        };

    console.log(`🎯 Discovering leads for project: ${project.name}`);

    // Generate search keywords using OpenAI
    const searchKeywords = await this.generateSearchKeywords(project);
    console.log(`📝 Generated keywords:`, searchKeywords);

    // Use the scraper to find leads
    const discoveredLeads = await this.leadScraper.scrapeLeads(
      project,
      payload.sources || ["all"],
      payload.maxResults || 50
    );

    // Store all leads in Nillion
    for (const lead of discoveredLeads) {
      await this.storeLead(lead, payload.ownerAddress);
    }

    // Log the discovery operation
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      agent_name: this.agentName,
      text: `Discovered and stored ${discoveredLeads.length} leads`,
      data: JSON.stringify({
        type: "LEADS_DISCOVERY",
        projectId: payload.projectId,
        count: discoveredLeads.length,
        sources: payload.sources,
        keywords: searchKeywords,
        timestamp: new Date().toISOString(),
      }),
    });

    console.log(`✅ Discovered and stored ${discoveredLeads.length} leads`);
    return discoveredLeads;
  }

  private async generateSearchKeywords(project: any): Promise<string[]> {
    const prompt = `
  Generate search keywords for finding business leads for this project:
  
  Project: ${project.name}
  Description: ${project.description}
  
  Generate 5-10 relevant keywords that would help find:
  1. Potential clients who might need this solution
  2. Companies in related industries  
  3. Business partners or collaborators
  4. Competitors or similar products
  
  Return as a JSON array of strings, e.g. ["keyword1", "keyword2", "keyword3"]
  Focus on specific, actionable terms rather than generic ones.
  `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const keywords = JSON.parse(content);
      return Array.isArray(keywords) ? keywords : [project.name];
    } catch (error) {
      console.error("Error generating keywords:", error);
      return [project.name, "business"].filter(Boolean);
    }
  }

  private async triggerLeadEmail(
    lead: Lead,
    ownerAddress: string
  ): Promise<void> {
    console.log(`📧 Triggering email for high-scoring lead: ${lead.name}`);

    try {
      await pushLogs({
        owner_address: ownerAddress,
        project_id: lead.projectId,
        agent_name: this.agentName,
        text: `High-scoring lead email triggered for ${lead.name}`,
        data: JSON.stringify({
          type: "LEAD_OPPORTUNITY_EMAIL",
          taskId: randomUUID(),
          workflowId: randomUUID(),
          payload: {
            projectName: "Project",
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
          timestamp: new Date().toISOString(),
        }),
      });

      console.log(`✅ Lead email triggered for ${lead.name}`);
    } catch (error) {
      console.error("Failed to trigger lead email:", error);
    }
  }

  async scoreLeads(payload: {
    projectId: string;
    ownerAddress: string;
    leadIds?: string[];
  }): Promise<Lead[]> {
    let leads: Lead[];

    if (payload.leadIds) {
      leads = await Promise.all(
        payload.leadIds.map((id) => this.getLead(id, payload.ownerAddress))
      );
    } else {
      leads = await this.getProjectLeads(
        payload.projectId,
        payload.ownerAddress
      );
    }

    // Get project info for scoring context
    const projectLeadsData = await fetchLeadsByAddress(payload.ownerAddress);
    const projectLead = projectLeadsData.find(
      (l) => l.project_id === payload.projectId
    );
    const project = projectLead
      ? {
          name: projectLead.name,
          description: projectLead.desc,
        }
      : { name: "Project", description: "Lead scoring project" };

    const scoredLeads: Lead[] = [];

    for (const lead of leads) {
      const score = await this.calculateLeadScore(lead, project);
      const updatedLead = { ...lead, score };

      await this.updateLead(updatedLead, payload.ownerAddress);
      scoredLeads.push(updatedLead);
    }

    // Log the scoring operation
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      agent_name: this.agentName,
      text: `Scored ${scoredLeads.length} leads`,
      data: JSON.stringify({
        type: "LEADS_SCORING",
        projectId: payload.projectId,
        count: scoredLeads.length,
        avgScore:
          scoredLeads.reduce((sum, lead) => sum + lead.score, 0) /
          scoredLeads.length,
        timestamp: new Date().toISOString(),
      }),
    });

    return scoredLeads;
  }

  async qualifyLead(payload: {
    leadId: string;
    ownerAddress: string;
  }): Promise<any> {
    const lead = await this.getLead(payload.leadId, payload.ownerAddress);

    // Get project context
    const projectLeadsData = await fetchLeadsByAddress(payload.ownerAddress);
    const projectLead = projectLeadsData.find(
      (l) => l.project_id === lead.projectId
    );
    const project = projectLead
      ? {
          name: projectLead.name,
          description: projectLead.desc,
        }
      : { name: "Project", description: "Lead qualification project" };

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

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const qualification = JSON.parse(content);

      // Update lead with qualification
      await this.updateLead(
        {
          ...lead,
          status:
            qualification.qualification === "High potential"
              ? "qualified"
              : "new",
          metadata: { ...lead.metadata, qualification },
        },
        payload.ownerAddress
      );

      // Log the qualification
      await pushLogs({
        owner_address: payload.ownerAddress,
        project_id: lead.projectId,
        agent_name: this.agentName,
        text: `Lead qualified: ${lead.name} - ${qualification.qualification}`,
        data: JSON.stringify({
          type: "LEAD_QUALIFICATION",
          leadId: lead.leadId,
          qualification,
          timestamp: new Date().toISOString(),
        }),
      });

      return qualification;
    } catch (error) {
      console.error("Error qualifying lead:", error);
      return {
        qualification: "Unknown",
        reasoning: "Analysis failed",
        nextSteps: ["Manual review required"],
        valueScore: 5,
        outreachApproach: "Standard approach",
      };
    }
  }

  async generateOutreachContent(payload: {
    leadId: string;
    ownerAddress: string;
    outreachType: "email" | "linkedin" | "cold_call";
  }): Promise<any> {
    const lead = await this.getLead(payload.leadId, payload.ownerAddress);

    // Get project context
    const projectLeadsData = await fetchLeadsByAddress(payload.ownerAddress);
    const projectLead = projectLeadsData.find(
      (l) => l.project_id === lead.projectId
    );
    const project = projectLead
      ? {
          name: projectLead.name,
          description: projectLead.desc,
        }
      : { name: "Project", description: "Outreach project" };

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

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const outreachContent = content.trim();

      // Log the outreach generation
      await pushLogs({
        owner_address: payload.ownerAddress,
        project_id: lead.projectId,
        agent_name: this.agentName,
        text: `Outreach content generated for ${lead.name} (${payload.outreachType})`,
        data: JSON.stringify({
          type: "OUTREACH_GENERATION",
          leadId: lead.leadId,
          outreachType: payload.outreachType,
          content: outreachContent.substring(0, 200) + "...", // Store truncated version in logs
          timestamp: new Date().toISOString(),
        }),
      });

      return {
        leadId: lead.leadId,
        outreachType: payload.outreachType,
        content: outreachContent,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error generating outreach content:", error);
      return {
        leadId: lead.leadId,
        outreachType: payload.outreachType,
        content: `Hello ${lead.name}, I'd like to discuss ${project.name} with you.`,
        generatedAt: new Date().toISOString(),
      };
    }
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

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const score = parseInt(content.match(/\d+/)?.[0] || "50");
      return Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error("Error calculating lead score:", error);
      return 50; // Default moderate score
    }
  }

  // Helper methods
  private async getLead(leadId: string, ownerAddress: string): Promise<Lead> {
    const leads = await fetchLeadsByAddress(ownerAddress);
    const leadData = leads.find((l) => {
      const metadata = JSON.parse(l.metadata);
      return metadata.leadId === leadId;
    });

    if (!leadData) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    return this.mapLeadsDataToLead(leadData);
  }

  private async getProjectLeads(
    projectId: string,
    ownerAddress: string
  ): Promise<Lead[]> {
    const leads = await fetchLeadsByAddress(ownerAddress);
    return leads
      .filter((l) => l.project_id === projectId)
      .map(this.mapLeadsDataToLead);
  }

  private async storeLead(lead: Lead, ownerAddress: string): Promise<void> {
    await pushLeads({
      name: lead.name,
      source: lead.source,
      desc: lead.company
        ? `${lead.company} - ${lead.title || "Contact"}`
        : lead.title || "Business Lead",
      metadata: JSON.stringify({
        leadId: lead.leadId,
        email: lead.email,
        company: lead.company,
        title: lead.title,
        website: lead.website,
        industry: lead.industry,
        location: lead.location,
        score: lead.score,
        status: lead.status,
        discoveredAt: lead.discoveredAt,
        lastContactedAt: lead.lastContactedAt,
        notes: lead.notes,
        matchReason: lead.matchReason,
        ...lead.metadata,
      }),
      owner_address: ownerAddress,
      project_id: lead.projectId,
    });
  }

  private async updateLead(lead: Lead, ownerAddress: string): Promise<void> {
    await this.storeLead(lead, ownerAddress);
  }

  private mapLeadsDataToLead(leadData: LeadsData): Lead {
    const metadata = JSON.parse(leadData.metadata);
    return {
      leadId: metadata.leadId || randomUUID(),
      projectId: leadData.project_id,
      name: leadData.name,
      email: metadata.email,
      company: metadata.company,
      title: metadata.title,
      website: metadata.website,
      industry: metadata.industry,
      location: metadata.location,
      score: metadata.score || 50,
      status: metadata.status || "new",
      source: leadData.source,
      discoveredAt: metadata.discoveredAt || new Date().toISOString(),
      lastContactedAt: metadata.lastContactedAt,
      notes: metadata.notes,
      metadata: metadata,
      matchReason: metadata.matchReason,
    };
  }

  async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    ownerAddress: string,
    result?: any,
    error?: string,
    characterResponse?: string
  ): Promise<void> {
    try {
      await pushLogs({
        owner_address: ownerAddress,
        project_id: workflowId,
        agent_name: this.agentName,
        text: error
          ? `Task ${taskId} failed: ${error}`
          : `Task ${taskId} completed successfully`,
        data: JSON.stringify({
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
      });
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}
