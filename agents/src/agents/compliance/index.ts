import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { ComplianceScrapingService } from "./service";
import { ProjectInfo, ProjectService } from "../../services/project";

// Using the exact interface from the service

export interface SimilarProject {
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
}

export class ComplianceAgent {
  private dynamodb: DynamoDBClient;
  private sqs: SQSClient;
  private complianceScraper: ComplianceScrapingService;
  private projectService: ProjectService;
  private orchestratorQueue: string;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.sqs = new SQSClient({ region: process.env.AWS_REGION });
    this.complianceScraper = new ComplianceScrapingService();
    this.projectService = new ProjectService(this.dynamodb);
    this.orchestratorQueue = process.env.ORCHESTRATOR_QUEUE_URL!;
  }

  async processTask(task: any): Promise<void> {
    console.log(`🔒 Processing compliance task: ${task.type}`);

    const characterInfo = task.payload.characterInfo || task.characterInfo;
    let characterResponse = "";

    try {
      let result;

      switch (task.type) {
        case "SCAN_SIMILAR_PROJECTS":
          const similarProjects = await this.scanSimilarProjects(task.payload);
          result = {
            similarProjects,
            count: similarProjects.length,
            flaggedCount: similarProjects.filter((p) => p.similarity > 85)
              .length,
          };
          break;

        case "PROJECT_CREATED_COMPLIANCE_CHECK":
          const complianceResults = await this.checkNewProjectCompliance(
            task.payload
          );
          // Auto-flag high similarity projects
          for (const project of complianceResults.filter(
            (p) => p.similarity > 90
          )) {
            await this.flagProject(
              task.payload.projectId,
              project,
              "High similarity detected"
            );
          }
          result = {
            complianceResults,
            count: complianceResults.length,
            flaggedCount: complianceResults.filter(
              (p) => p.status === "flagged"
            ).length,
          };
          break;

        case "GET_SIMILAR_PROJECTS":
          const getSimilarResults = await this.getSimilarProjects(task.payload);
          result = { similarProjects: getSimilarResults };
          break;

        case "SEARCH_SIMILAR_PROJECTS":
          const searchResults = await this.searchSimilarProjects(task.payload);
          result = { searchResults };
          break;

        case "ANALYZE_SIMILARITY":
          const analysis = await this.analyzeSimilarity(task.payload);
          result = { analysis };
          break;

        case "REVIEW_COMPLIANCE":
          const review = await this.reviewCompliance(task.payload);
          result = { review };
          break;

        case "FLAG_PROJECT":
          const flagResult = await this.flagProject(
            task.payload.projectId,
            task.payload.complianceProject,
            task.payload.reason
          );
          result = { flagResult };
          break;

        case "CLEAR_PROJECT":
          const clearResult = await this.clearProject(task.payload);
          result = { clearResult };
          break;

        case "GET_COMPLIANCE_STATS":
          const stats = await this.getComplianceStats(task.payload);
          result = { stats };
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Generate character response
      if (characterInfo?.agentCharacter) {
        if (characterInfo.side === "light") {
          characterResponse =
            "Justice and fairness guide my watch. Your project, protected it shall be. Vigilant against threats, I remain.";
        } else {
          characterResponse =
            "*ignites lightsaber* No mercy for those who dare copy your work. Destroyed, they will be. Fear me, plagiarists must.";
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
            ? "Failed to protect your project, I have. Disappointed in myself, I am."
            : "*mechanical rage* This failure is unacceptable! The Empire demands perfection!";
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

  async checkNewProjectCompliance(payload: {
    projectId: string;
    projectName: string;
    description: string;
    sources?: string[];
    maxResults?: number;
  }): Promise<SimilarProject[]> {
    console.log(`🔍 Starting compliance check for: ${payload.projectName}`);

    return await this.scanSimilarProjects({
      projectId: payload.projectId,
      sources: payload.sources || ["all"],
      maxResults: payload.maxResults || 100,
    });
  }

  async scanSimilarProjects(payload: {
    projectId: string;
    sources?: string[];
    maxResults?: number;
  }): Promise<SimilarProject[]> {
    const project = await this.projectService.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    console.log(`🔒 Scanning for similar projects to: ${project.name}`);

    // Use the service with correct parameters (project object, sources array, maxResults number)
    const discoveredProjects = await this.complianceScraper.scrapeProjects(
      project,
      payload.sources || ["all"],
      payload.maxResults || 50
    );

    // Process and enhance the results
    const analyzedProjects: SimilarProject[] = [];
    for (const scrapedProject of discoveredProjects) {
      // Calculate more accurate similarity
      const similarity = await this.calculateSimilarity(
        project,
        scrapedProject
      );

      // Update the project with our calculated similarity
      const analyzedProject: SimilarProject = {
        ...scrapedProject,
        similarity, // Override the random similarity from scraper
        status: "pending_review",
        discoveredAt: new Date().toISOString(),
      };

      analyzedProjects.push(analyzedProject);
    }

    // Sort by similarity score
    const sortedProjects = analyzedProjects.sort(
      (a, b) => b.similarity - a.similarity
    );

    // Store all compliance projects in the project's compliance data
    const project_updated = await this.projectService.getProject(
      payload.projectId
    );
    if (project_updated) {
      const existingCompliance = project_updated.compliance || {};
      const updatedCompliance = {
        ...existingCompliance,
        similarProjects: sortedProjects,
        lastScanAt: new Date().toISOString(),
        totalFound: sortedProjects.length,
        flaggedCount: sortedProjects.filter((p) => p.similarity > 85).length,
        highRiskCount: sortedProjects.filter((p) => p.similarity > 90).length,
      };

      await this.projectService.updateProjectData(
        payload.projectId,
        "compliance",
        updatedCompliance
      );
    }

    console.log(
      `✅ Found and analyzed ${sortedProjects.length} similar projects`
    );
    return sortedProjects;
  }

  async getSimilarProjects(payload: {
    projectId: string;
  }): Promise<SimilarProject[]> {
    const project = await this.projectService.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    // Return existing compliance data from project
    return project.compliance?.similarProjects || [];
  }

  async searchSimilarProjects(payload: {
    projectId: string;
    searchTerm: string;
    sources?: string[];
    maxResults?: number;
  }): Promise<SimilarProject[]> {
    const project = await this.projectService.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    console.log(
      `🔍 Searching for projects similar to: "${payload.searchTerm}"`
    );

    // Create modified project for targeted search
    const modifiedProject = {
      ...project,
      name: payload.searchTerm,
      description: `${project.description} ${payload.searchTerm}`,
    };

    const searchResults = await this.complianceScraper.scrapeProjects(
      modifiedProject,
      payload.sources || ["all"],
      payload.maxResults || 50
    );

    // Calculate similarity for search results
    const analyzedResults: SimilarProject[] = [];
    for (const result of searchResults) {
      const similarity = await this.calculateSimilarity(project, result);

      analyzedResults.push({
        ...result,
        similarity,
        status: "pending_review",
        discoveredAt: new Date().toISOString(),
      });
    }

    return analyzedResults.sort((a, b) => b.similarity - a.similarity);
  }

  async analyzeSimilarity(payload: {
    projectId: string;
    complianceId: string;
  }): Promise<any> {
    const project = await this.projectService.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const complianceProject = project.compliance?.similarProjects?.find(
      (p) => p.complianceId === payload.complianceId
    );

    if (!complianceProject) {
      throw new Error(`Compliance project not found: ${payload.complianceId}`);
    }

    const analysis = {
      similarities: [
        "Both projects focus on similar technology stack",
        "Similar naming conventions used",
        "Comparable feature sets identified",
        "Related problem domains addressed",
      ],
      differences: [
        "Different implementation approaches",
        "Unique business models",
        "Distinct user target audiences",
        "Varied technical architectures",
      ],
      concerns:
        complianceProject.similarity > 80
          ? [
              "High similarity score detected",
              "Potential intellectual property overlap",
              "Requires manual review and investigation",
              "Consider legal consultation",
            ]
          : [
              "Low risk of IP conflicts",
              "Acceptable similarity levels",
              "Normal market competition",
              "No immediate concerns",
            ],
      recommendation:
        complianceProject.similarity > 90
          ? "flag"
          : complianceProject.similarity > 70
          ? "investigate"
          : "clear",
      riskLevel:
        complianceProject.similarity > 90
          ? "HIGH"
          : complianceProject.similarity > 70
          ? "MEDIUM"
          : "LOW",
      similarityScore: complianceProject.similarity,
      detailedAnalysis: {
        nameMatch: this.calculateNameSimilarity(
          project.name,
          complianceProject.projectName
        ),
        descriptionMatch: this.calculateDescriptionSimilarity(
          project.description || "",
          complianceProject.description
        ),
        technicalMatch: this.calculateTechnicalSimilarity(
          project,
          complianceProject
        ),
      },
    };

    // Update compliance project with analysis
    const updatedSimilarProjects =
      project.compliance?.similarProjects?.map((p) =>
        p.complianceId === payload.complianceId
          ? { ...p, metadata: { analysis } }
          : p
      ) || [];

    await this.projectService.updateProjectData(
      payload.projectId,
      "compliance",
      {
        ...project.compliance,
        similarProjects: updatedSimilarProjects,
      }
    );

    return analysis;
  }

  async reviewCompliance(payload: {
    projectId: string;
    complianceId: string;
    action: "flag" | "clear" | "investigate";
    reason?: string;
    reviewerNotes?: string;
  }): Promise<any> {
    const project = await this.projectService.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const updatedSimilarProjects =
      project.compliance?.similarProjects?.map((p) =>
        p.complianceId === payload.complianceId
          ? {
              ...p,
              status:
                payload.action === "flag"
                  ? "flagged"
                  : payload.action === "clear"
                  ? "cleared"
                  : "reviewed",
              reviewedAt: new Date().toISOString(),
              flagReason:
                payload.action === "flag" ? payload.reason : undefined,
              reviewerNotes: payload.reviewerNotes,
            }
          : p
      ) || [];

    // Update flagged count
    const flaggedCount = updatedSimilarProjects.filter(
      (p) => p.status === "flagged"
    ).length;
    const clearedCount = updatedSimilarProjects.filter(
      (p) => p.status === "cleared"
    ).length;

    await this.projectService.updateProjectData(
      payload.projectId,
      "compliance",
      {
        ...project.compliance,
        similarProjects: updatedSimilarProjects,
        flaggedCount,
        clearedCount,
        lastReviewAt: new Date().toISOString(),
      }
    );

    return {
      complianceId: payload.complianceId,
      action: payload.action,
      status:
        payload.action === "flag"
          ? "flagged"
          : payload.action === "clear"
          ? "cleared"
          : "reviewed",
      reviewedAt: new Date().toISOString(),
      reason: payload.reason,
      reviewerNotes: payload.reviewerNotes,
    };
  }

  async flagProject(
    projectId: string,
    complianceProject: SimilarProject,
    reason: string
  ): Promise<any> {
    console.log(
      `🚩 Flagging project: ${complianceProject.projectName} - ${reason}`
    );

    return await this.reviewCompliance({
      projectId,
      complianceId: complianceProject.complianceId,
      action: "flag",
      reason,
      reviewerNotes: "Auto-flagged by compliance system",
    });
  }

  async clearProject(payload: {
    projectId: string;
    complianceId: string;
    reason?: string;
  }): Promise<any> {
    console.log(`✅ Clearing project: ${payload.complianceId}`);

    return await this.reviewCompliance({
      projectId: payload.projectId,
      complianceId: payload.complianceId,
      action: "clear",
      reason: payload.reason,
      reviewerNotes: "Cleared after review",
    });
  }

  async getComplianceStats(payload: { projectId: string }): Promise<any> {
    const project = await this.projectService.getProject(payload.projectId);
    if (!project) {
      throw new Error(`Project not found: ${payload.projectId}`);
    }

    const compliance = project.compliance as ProjectInfo["compliance"];
    const similarProjects = compliance?.similarProjects || [];

    return {
      totalProjects: similarProjects.length,
      flaggedCount: similarProjects.filter(
        (p: SimilarProject) => p.status === "flagged"
      ).length,
      clearedCount: similarProjects.filter(
        (p: SimilarProject) => p.status === "cleared"
      ).length,
      pendingCount: similarProjects.filter(
        (p: SimilarProject) => p.status === "pending_review"
      ).length,
      highRiskCount: similarProjects.filter(
        (p: SimilarProject) => p.similarity > 90
      ).length,
      mediumRiskCount: similarProjects.filter(
        (p: SimilarProject) => p.similarity > 70 && p.similarity <= 90
      ).length,
      lowRiskCount: similarProjects.filter(
        (p: SimilarProject) => p.similarity <= 70
      ).length,
      averageSimilarity:
        similarProjects.length > 0
          ? similarProjects.reduce(
              (sum: number, p: SimilarProject) => sum + p.similarity,
              0
            ) / similarProjects.length
          : 0,
      lastScanAt: compliance?.lastScanAt || "",
    };
  }

  private async calculateSimilarity(
    originalProject: any,
    complianceProject: any
  ): Promise<number> {
    // Enhanced similarity calculation
    const nameScore = this.calculateNameSimilarity(
      originalProject.name,
      complianceProject.projectName
    );
    const descScore = this.calculateDescriptionSimilarity(
      originalProject.description,
      complianceProject.description
    );
    const techScore = this.calculateTechnicalSimilarity(
      originalProject,
      complianceProject
    );

    // Weighted average: name 30%, description 50%, technical 20%
    const similarity = nameScore * 0.3 + descScore * 0.5 + techScore * 0.2;

    return Math.min(100, Math.max(0, Math.round(similarity)));
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    const clean1 = name1.toLowerCase().trim();
    const clean2 = name2.toLowerCase().trim();

    if (clean1 === clean2) return 100;

    const words1 = new Set(clean1.split(/\s+/));
    const words2 = new Set(clean2.split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return (intersection.size / union.size) * 100;
  }

  private calculateDescriptionSimilarity(desc1: string, desc2: string): number {
    if (!desc1 || !desc2) return 0;

    const clean1 = desc1.toLowerCase().trim();
    const clean2 = desc2.toLowerCase().trim();

    const words1 = new Set(
      clean1.split(/\s+/).filter((word) => word.length > 3)
    );
    const words2 = new Set(
      clean2.split(/\s+/).filter((word) => word.length > 3)
    );

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
  }

  private calculateTechnicalSimilarity(project1: any, project2: any): number {
    // Compare technical aspects like platform, languages, etc.
    let score = 0;
    let factors = 0;

    // Platform similarity
    if (project2.platform && project1.platform) {
      factors++;
      if (project1.platform.toLowerCase() === project2.platform.toLowerCase()) {
        score += 100;
      }
    }

    // Tags/technology similarity
    if (project2.tags && project1.keywords) {
      factors++;
      const tags1 = new Set(
        (project1.keywords || []).map((t: string) => t.toLowerCase())
      );
      const tags2 = new Set(
        (project2.tags || []).map((t: string) => t.toLowerCase())
      );

      const intersection = new Set([...tags1].filter((x) => tags2.has(x)));
      const union = new Set([...tags1, ...tags2]);

      if (union.size > 0) {
        score += (intersection.size / union.size) * 100;
      }
    }

    return factors > 0 ? score / factors : 0;
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string,
    characterResponse?: string
  ) {
    try {
      console.log("Task Completion report payload");
      console.log({
        taskId,
        workflowId,
        status: error ? "FAILED" : "COMPLETED",
        result: result ? { ...result, characterResponse } : null,
        error,
        timestamp: new Date().toISOString(),
        agent: "monitoring-compliance",
      });

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
              agent: "monitoring-compliance",
            },
          }),
        })
      );
      console.log(`📤 Task completion reported: ${taskId}`);
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}
