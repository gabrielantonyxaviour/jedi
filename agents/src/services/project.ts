import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

interface Developer {
  name: string;
  github_username: string;
}

export interface ProjectInfo {
  // Core Project Info
  projectId: string;
  name: string;
  description?: string;
  technicalDescription?: string;
  imageUrl?: string;

  // GitHub Integration
  githubUrl: string;
  repo: string;
  developers: Developer[];
  languages?: string[];

  // Project Metadata
  ownerId: string;
  side: "light" | "dark";
  summary?: string;
  technicalSummary?: string;
  industry?: string;
  keywords?: string[];

  // Setup Progress Tracking
  setup_state: "GITHUB" | "INFO" | "SOCIALS" | "KARMA" | "IP";
  setup_completed_steps: string[]; // ["GITHUB", "INFO", ...]
  setup_started_at: string;
  setup_completed_at?: string;

  // Social Media Agent Data
  socials?: {
    isSetup: boolean;
    platforms: {
      twitter?: {
        username: string;
        isActive: boolean;
        lastPost?: string;
        followers?: number;
        posts?: number;
      };
      linkedin?: {
        isActive: boolean;
        connections?: number;
        posts?: number;
      };
      telegram?: {
        botToken: string;
        isActive: boolean;
        members?: number;
      };
    };
    character: {
      name: string;
      personality: string;
      tone: string;
    };
    autoPost: boolean;
    postsPerDay: string;
    setupAt?: string;
  };

  // Karma Integration Data
  karma?: {
    isSetup: boolean;
    karmaUID?: string;
    karmaProjectId?: string;
    ownerAddress: string;
    members?: string[];
    grants: Array<{
      uid: string;
      title: string;
      status: string;
      communityUID: string;
      milestones: Array<{
        uid: string;
        title: string;
        status: string;
        dueDate: string;
        completedAt?: string;
      }>;
    }>;
    opportunities?: Array<{
      grantUID: string;
      communityName: string;
      grantTitle: string;
      deadline?: string;
      amount?: string;
    }>;
    setupAt?: string;
  };

  // IP Protection Data
  ip?: {
    isSetup: boolean;
    registrationId?: string;
    ipId?: string; // Story Protocol IP ID
    txHash?: string;
    licenseTermsIds?: string[];
    royaltyPercentage?: number;
    remixFee?: string;
    commercialRevShare?: number;
    licenses: Array<{
      licenseId: string;
      licenseType: "commercial_fork" | "custom_remix" | "open_source";
      derivativeIpId?: string;
      parentIpId?: string;
      txHash: string;
      createdAt: string;
    }>;
    disputes: Array<{
      disputeId: string;
      targetIpId: string;
      evidence: string;
      status: "pending" | "resolved" | "dismissed";
      createdAt: string;
    }>;
    royalties: Array<{
      transactionId: string;
      amount: string;
      token: string;
      type: "payment" | "claim";
      status: "pending" | "confirmed" | "failed";
      timestamp: number;
    }>;
    setupAt?: string;
  };

  // Compliance Monitoring Data
  compliance?: {
    isActive: boolean;
    similarProjects: Array<{
      complianceId: string;
      projectName: string;
      description: string;
      url: string;
      platform: string;
      similarity: number;
      status: "pending_review" | "flagged" | "cleared" | "reviewed";
      discoveredAt: string;
      reviewedAt?: string;
      flagReason?: string;
    }>;
    lastScanAt?: string;
    flaggedCount: number;
    totalScanned: number;
  };

  // Lead Generation Data
  leads?: {
    isActive: boolean;
    totalLeads: number;
    sources: Array<{
      source: string;
      count: number;
      lastScanned?: string;
    }>;
    leads: Array<{
      leadId: string;
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
      matchReason?: string;
    }>;
    lastScanAt?: string;
    highValueLeads: number; // score > 80
  };

  // Project Statistics
  stats?: {
    totalWorkflows: number;
    completedTasks: number;
    failedTasks: number;
    lastActivity?: string;
    uptime?: string;
  };

  // Timestamps
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export class ProjectService {
  constructor(private dynamoClient: DynamoDBClient) {}

  async createProject(
    project: Omit<
      ProjectInfo,
      | "createdAt"
      | "updatedAt"
      | "setup_state"
      | "setup_completed_steps"
      | "setup_started_at"
    >
  ): Promise<ProjectInfo> {
    const now = new Date().toISOString();
    const projectInfo: ProjectInfo = {
      ...project,
      setup_state: "GITHUB",
      setup_completed_steps: ["GITHUB"],
      setup_started_at: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: "projects",
        Item: marshall(projectInfo),
      })
    );

    return projectInfo;
  }

  async updateProjectSetupStep(
    projectId: string,
    newState: ProjectInfo["setup_state"],
    stepData?: any
  ): Promise<ProjectInfo> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updatedSteps = [...project.setup_completed_steps];
    if (!updatedSteps.includes(newState)) {
      updatedSteps.push(newState);
    }

    const updates: Partial<ProjectInfo> = {
      setup_state: newState,
      setup_completed_steps: updatedSteps,
      updatedAt: new Date().toISOString(),
    };

    // If final step (IP), mark as completed
    if (newState === "IP") {
      updates.setup_completed_at = new Date().toISOString();
    }

    // Add step-specific data
    if (stepData) {
      switch (newState) {
        case "INFO":
          Object.assign(updates, {
            name: stepData.name,
            description: stepData.description,
            technicalDescription: stepData.technicalDescription,
            imageUrl: stepData.imageUrl,
            keywords: stepData.keywords,
          });
          break;
        case "SOCIALS":
          updates.socials = stepData;
          break;
        case "KARMA":
          updates.karma = stepData;
          break;
        case "IP":
          updates.ip = stepData;
          break;
      }
    }

    return await this.updateProject(projectId, updates);
  }

  async updateProjectData(
    projectId: string,
    section: keyof ProjectInfo,
    data: any
  ): Promise<ProjectInfo> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updates = {
      [section]: { ...(project[section] as object), ...data },
      updatedAt: new Date().toISOString(),
    };

    return await this.updateProject(projectId, updates);
  }

  // Add methods for specific data updates
  async addComplianceProject(
    projectId: string,
    complianceData: any
  ): Promise<ProjectInfo> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const currentCompliance = project.compliance || {
      isActive: true,
      similarProjects: [],
      flaggedCount: 0,
      totalScanned: 0,
    };

    currentCompliance.similarProjects.push(complianceData);
    currentCompliance.totalScanned += 1;
    currentCompliance.lastScanAt = new Date().toISOString();

    if (complianceData.status === "flagged") {
      currentCompliance.flaggedCount += 1;
    }

    return await this.updateProjectData(
      projectId,
      "compliance",
      currentCompliance
    );
  }

  async addLead(projectId: string, leadData: any): Promise<ProjectInfo> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const currentLeads = project.leads || {
      isActive: true,
      totalLeads: 0,
      sources: [],
      leads: [],
      highValueLeads: 0,
    };

    currentLeads.leads.push(leadData);
    currentLeads.totalLeads += 1;
    currentLeads.lastScanAt = new Date().toISOString();

    if (leadData.score > 80) {
      currentLeads.highValueLeads += 1;
    }

    // Update source counts
    const sourceIndex = currentLeads.sources.findIndex(
      (s) => s.source === leadData.source
    );
    if (sourceIndex >= 0) {
      currentLeads.sources[sourceIndex].count += 1;
      currentLeads.sources[sourceIndex].lastScanned = new Date().toISOString();
    } else {
      currentLeads.sources.push({
        source: leadData.source,
        count: 1,
        lastScanned: new Date().toISOString(),
      });
    }

    return await this.updateProjectData(projectId, "leads", currentLeads);
  }

  async addKarmaGrant(projectId: string, grantData: any): Promise<ProjectInfo> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    if (!project.karma) {
      throw new Error("Karma not setup for this project");
    }

    project.karma.grants.push(grantData);
    return await this.updateProjectData(projectId, "karma", project.karma);
  }

  async addIPLicense(
    projectId: string,
    licenseData: any
  ): Promise<ProjectInfo> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    if (!project.ip) {
      throw new Error("IP protection not setup for this project");
    }

    project.ip.licenses.push(licenseData);
    return await this.updateProjectData(projectId, "ip", project.ip);
  }

  // Existing methods remain the same...
  async getProject(projectId: string): Promise<ProjectInfo | null> {
    const result = await this.dynamoClient.send(
      new GetItemCommand({
        TableName: "projects",
        Key: marshall({ projectId }),
      })
    );

    if (!result.Item) {
      return null;
    }

    return unmarshall(result.Item) as ProjectInfo;
  }

  async updateProject(
    projectId: string,
    updates: Partial<ProjectInfo>
  ): Promise<ProjectInfo> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updatedProject: ProjectInfo = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: "projects",
        Item: marshall(updatedProject),
      })
    );

    return updatedProject;
  }

  async getProjectsByOwner(ownerId: string): Promise<ProjectInfo[]> {
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: "projects",
        IndexName: "OwnerIndex",
        KeyConditionExpression: "ownerId = :ownerId",
        ExpressionAttributeValues: marshall({
          ":ownerId": ownerId,
        }),
      })
    );

    return (result.Items || []).map((item) => unmarshall(item) as ProjectInfo);
  }
}
