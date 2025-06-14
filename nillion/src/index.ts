import dotenv from "dotenv";
dotenv.config();

import { ServiceFactory } from "./services";
import { AgentName } from "./types";

export class MultiAgentSystem {
  private services = {
    logs: ServiceFactory.getLogs(),
    github: ServiceFactory.getGithub(),
    leads: ServiceFactory.getLeads(),
    stories: ServiceFactory.getStories(),
    socials: ServiceFactory.getSocials(),
    grants: ServiceFactory.getGrants(),
    compliance: ServiceFactory.getCompliance(),
  };

  async init(): Promise<void> {
    console.log("🚀 Initializing Multi-Agent System...");

    // Initialize all services
    await Promise.all([
      this.services.logs.init(),
      this.services.github.init(),
      this.services.leads.init(),
      this.services.stories.init(),
      this.services.socials.init(),
      this.services.grants.init(),
      this.services.compliance.init(),
    ]);

    console.log("✅ Multi-Agent System initialized successfully");
  }

  // Agent communication methods
  async logAgentAction(
    projectId: string,
    agentName: AgentName,
    action: string,
    data: Record<string, any>
  ): Promise<string> {
    return await this.services.logs.createLog(
      projectId,
      agentName,
      action,
      data
    );
  }

  async getAgentCommunications(projectId: string): Promise<any[]> {
    return await this.services.logs.getLogsByProject(projectId);
  }

  async getAgentHistory(agentName: AgentName): Promise<any[]> {
    return await this.services.logs.getLogsByAgent(agentName);
  }

  // Cross-agent workflows
  async githubToLeadsWorkflow(
    projectId: string,
    repoUrl: string
  ): Promise<void> {
    // GitHub agent analyzes repo
    await this.logAgentAction(projectId, "github", "Analyzing repository", {
      repoUrl,
      analysis: "Repository structure analyzed, technologies identified",
    });

    // Leads agent identifies potential clients
    await this.logAgentAction(
      projectId,
      "leads",
      "Identifying potential leads",
      {
        sourceRepo: repoUrl,
        leadCount: 3,
        targets: ["enterprise", "startups", "open_source_contributors"],
      }
    );

    // Orchestrator coordinates next steps
    await this.logAgentAction(
      projectId,
      "orchestrator",
      "Coordinating follow-up actions",
      {
        nextSteps: [
          "social_media_outreach",
          "content_creation",
          "lead_qualification",
        ],
      }
    );
  }

  async socialMediaCampaignWorkflow(
    projectId: string,
    campaignData: any
  ): Promise<void> {
    // Socials agent creates campaign
    await this.logAgentAction(
      projectId,
      "socials",
      "Launching social media campaign",
      {
        platforms: ["twitter", "linkedin"],
        campaign: campaignData,
        reach: "estimated_10k_impressions",
      }
    );

    // Leads agent tracks responses
    await this.logAgentAction(
      projectId,
      "leads",
      "Monitoring campaign responses",
      {
        engagement: "tracking_clicks_and_mentions",
        leadSources: ["twitter_dm", "linkedin_message"],
      }
    );
  }

  async complianceCheckWorkflow(
    projectId: string,
    dataTypes: string[]
  ): Promise<void> {
    // Compliance agent evaluates data handling
    await this.logAgentAction(
      projectId,
      "compliance",
      "Evaluating data compliance",
      {
        dataTypes,
        regulations: ["GDPR", "CCPA", "HIPAA"],
        status: "review_required",
      }
    );

    // IP agent checks intellectual property
    await this.logAgentAction(projectId, "ip", "Reviewing IP considerations", {
      patents: "pending_search",
      trademarks: "cleared",
      licenses: "open_source_compatible",
    });
  }

  // Service getters for direct access
  get logs() {
    return this.services.logs;
  }
  get github() {
    return this.services.github;
  }
  get leads() {
    return this.services.leads;
  }
  get stories() {
    return this.services.stories;
  }
  get socials() {
    return this.services.socials;
  }
  get grants() {
    return this.services.grants;
  }
  get compliance() {
    return this.services.compliance;
  }
}

// Export everything
export * from "./types";
export * from "./services";
export * from "./config/nillion";

// Demo usage
async function demo() {
  const system = new MultiAgentSystem();
  await system.init();

  const projectId = "demo-project-001";

  console.log("🎭 Running Multi-Agent Demo...\n");

  // Simulate agent interactions
  await system.githubToLeadsWorkflow(
    projectId,
    "https://github.com/demo/ai-project"
  );
  await system.socialMediaCampaignWorkflow(projectId, {
    message: "Check out our new AI tool!",
    hashtags: ["#AI", "#Innovation"],
  });
  await system.complianceCheckWorkflow(projectId, [
    "user_data",
    "analytics",
    "preferences",
  ]);

  // Show communications
  const communications = await system.getAgentCommunications(projectId);
  console.log(`📋 Project Communications (${communications.length} entries):`);
  communications.forEach((comm, i) => {
    console.log(`  ${i + 1}. [${comm.agentName}] ${comm.text}`);
  });
}

if (require.main === module) {
  demo().catch(console.error);
}
