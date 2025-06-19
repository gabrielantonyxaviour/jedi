import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
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
  private tableName: string;

  constructor(private dynamoClient: DynamoDBClient) {
    this.tableName = process.env.PROJECTS_TABLE_NAME || "projects";
  }

  // Helper method to safely marshall data
  private safeMarshall(data: any): any {
    return marshall(data, {
      removeUndefinedValues: true,
      convertEmptyValues: false,
    });
  }

  // Helper method for safe DynamoDB operations
  private async safeDynamoOperation<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (
        error.name === "ValidationException" &&
        error.message.includes("removeUndefinedValues")
      ) {
        console.error(
          "DynamoDB validation error - undefined values detected:",
          error
        );
        throw new Error(
          "Data validation failed - please check for undefined values"
        );
      }
      throw error;
    }
  }

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

    return this.safeDynamoOperation(async () => {
      await this.dynamoClient.send(
        new PutItemCommand({
          TableName: this.tableName,
          Item: this.safeMarshall(projectInfo),
        })
      );

      return projectInfo;
    });
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
            name: stepData.name || project.name,
            description: stepData.description,
            technicalDescription: stepData.technicalDescription,
            imageUrl: stepData.imageUrl,
            keywords: stepData.keywords || [],
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

    // Clean the data to remove undefined values
    const cleanData = JSON.parse(JSON.stringify(data));

    const updates = {
      [section]: { ...(project[section] as object), ...cleanData },
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

    // Clean the compliance data
    const cleanComplianceData = JSON.parse(JSON.stringify(complianceData));

    currentCompliance.similarProjects.push(cleanComplianceData);
    currentCompliance.totalScanned += 1;
    currentCompliance.lastScanAt = new Date().toISOString();

    if (cleanComplianceData.status === "flagged") {
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

    // Clean the lead data
    const cleanLeadData = JSON.parse(JSON.stringify(leadData));

    currentLeads.leads.push(cleanLeadData);
    currentLeads.totalLeads += 1;
    currentLeads.lastScanAt = new Date().toISOString();

    if (cleanLeadData.score > 80) {
      currentLeads.highValueLeads += 1;
    }

    // Update source counts
    const sourceIndex = currentLeads.sources.findIndex(
      (s) => s.source === cleanLeadData.source
    );
    if (sourceIndex >= 0) {
      currentLeads.sources[sourceIndex].count += 1;
      currentLeads.sources[sourceIndex].lastScanned = new Date().toISOString();
    } else {
      currentLeads.sources.push({
        source: cleanLeadData.source,
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

    const cleanGrantData = JSON.parse(JSON.stringify(grantData));
    project.karma.grants.push(cleanGrantData);

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

    const cleanLicenseData = JSON.parse(JSON.stringify(licenseData));
    project.ip.licenses.push(cleanLicenseData);

    return await this.updateProjectData(projectId, "ip", project.ip);
  }

  // Existing methods remain the same...
  async getProject(projectId: string): Promise<ProjectInfo | null> {
    return this.safeDynamoOperation(async () => {
      const payload = await this.dynamoClient.send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: this.safeMarshall({ projectId }),
        })
      );

      if (!payload.Item) {
        return null;
      }

      return unmarshall(payload.Item) as ProjectInfo;
    });
  }

  async updateProject(
    projectId: string,
    updates: Partial<ProjectInfo>
  ): Promise<ProjectInfo> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Clean updates to remove undefined values
    const cleanUpdates = JSON.parse(JSON.stringify(updates));
    cleanUpdates.updatedAt = new Date().toISOString();

    return this.safeDynamoOperation(async () => {
      // Build UpdateExpression dynamically
      const updateExpressions: string[] = [];
      const expressionAttributeValues: any = {};
      const expressionAttributeNames: any = {};

      Object.keys(cleanUpdates).forEach((key, index) => {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;

        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = cleanUpdates[key];
      });

      if (updateExpressions.length === 0) {
        return project; // No updates to make
      }

      await this.dynamoClient.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: this.safeMarshall({ projectId }),
          UpdateExpression: `SET ${updateExpressions.join(", ")}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: this.safeMarshall(
            expressionAttributeValues
          ),
          ReturnValues: "ALL_NEW",
        })
      );

      // Return the updated project
      return (await this.getProject(projectId)) as ProjectInfo;
    });
  }

  async getProjectsByOwner(ownerId: string): Promise<ProjectInfo[]> {
    return this.safeDynamoOperation(async () => {
      const payload = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "OwnerIndex",
          KeyConditionExpression: "ownerId = :ownerId",
          ExpressionAttributeValues: this.safeMarshall({
            ":ownerId": ownerId,
          }),
        })
      );

      return (payload.Items || []).map(
        (item) => unmarshall(item) as ProjectInfo
      );
    });
  }

  // Utility method to clean project data
  private cleanProjectData(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }

    if (Array.isArray(data)) {
      return data
        .map((item) => this.cleanProjectData(item))
        .filter((item) => item !== null);
    }

    if (typeof data === "object") {
      const cleaned: any = {};
      Object.keys(data).forEach((key) => {
        const value = this.cleanProjectData(data[key]);
        if (value !== null && value !== undefined) {
          cleaned[key] = value;
        }
      });
      return cleaned;
    }

    return data;
  }
}
