"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiAgentSystem = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const index_js_1 = require("./services/index.js");
class MultiAgentSystem {
    constructor() {
        this.services = {
            logs: index_js_1.ServiceFactory.getLogs(),
            github: index_js_1.ServiceFactory.getGithub(),
            leads: index_js_1.ServiceFactory.getLeads(),
            stories: index_js_1.ServiceFactory.getStories(),
            socials: index_js_1.ServiceFactory.getSocials(),
            grants: index_js_1.ServiceFactory.getGrants(),
            compliance: index_js_1.ServiceFactory.getCompliance(),
        };
    }
    async init() {
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
    async logAgentAction(projectId, agentName, action, data) {
        return await this.services.logs.createLog(projectId, agentName, action, data);
    }
    async getAgentCommunications(projectId) {
        return await this.services.logs.getLogsByProject(projectId);
    }
    async getAgentHistory(agentName) {
        return await this.services.logs.getLogsByAgent(agentName);
    }
    // Cross-agent workflows
    async githubToLeadsWorkflow(projectId, repoUrl) {
        // GitHub agent analyzes repo
        await this.logAgentAction(projectId, "github", "Analyzing repository", {
            repoUrl,
            analysis: "Repository structure analyzed, technologies identified",
        });
        // Leads agent identifies potential clients
        await this.logAgentAction(projectId, "leads", "Identifying potential leads", {
            sourceRepo: repoUrl,
            leadCount: 3,
            targets: ["enterprise", "startups", "open_source_contributors"],
        });
        // Orchestrator coordinates next steps
        await this.logAgentAction(projectId, "orchestrator", "Coordinating follow-up actions", {
            nextSteps: [
                "social_media_outreach",
                "content_creation",
                "lead_qualification",
            ],
        });
    }
    async socialMediaCampaignWorkflow(projectId, campaignData) {
        // Socials agent creates campaign
        await this.logAgentAction(projectId, "socials", "Launching social media campaign", {
            platforms: ["twitter", "linkedin"],
            campaign: campaignData,
            reach: "estimated_10k_impressions",
        });
        // Leads agent tracks responses
        await this.logAgentAction(projectId, "leads", "Monitoring campaign responses", {
            engagement: "tracking_clicks_and_mentions",
            leadSources: ["twitter_dm", "linkedin_message"],
        });
    }
    async complianceCheckWorkflow(projectId, dataTypes) {
        // Compliance agent evaluates data handling
        await this.logAgentAction(projectId, "compliance", "Evaluating data compliance", {
            dataTypes,
            regulations: ["GDPR", "CCPA", "HIPAA"],
            status: "review_required",
        });
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
exports.MultiAgentSystem = MultiAgentSystem;
// Export everything
__exportStar(require("./types/index.js"), exports);
__exportStar(require("./services/index.js"), exports);
__exportStar(require("./config/nillion.js"), exports);
// Demo usage
async function demo() {
    const system = new MultiAgentSystem();
    await system.init();
    const projectId = "demo-project-001";
    console.log("🎭 Running Multi-Agent Demo...\n");
    // Simulate agent interactions
    await system.githubToLeadsWorkflow(projectId, "https://github.com/demo/ai-project");
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
