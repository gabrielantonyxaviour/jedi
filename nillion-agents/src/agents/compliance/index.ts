// src/agents/compliance-agent.ts
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { ComplianceScrapingService } from "./service";
import {
  pushCompliance,
  fetchCompliance,
  fetchComplianceByAddress,
  pushLogs,
  fetchLogs,
  fetchLogsByAddress,
} from "../../services/nillion";
import { ComplianceData, LogsData } from "../../types/nillion";

export class ComplianceAgent {
  private openai: OpenAI;
  private complianceScraper: ComplianceScrapingService;
  private agentName: string = "compliance-agent";

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.MY_OPENAI_KEY,
    });
    this.complianceScraper = new ComplianceScrapingService();
  }

  async processTask(task: any): Promise<void> {
    console.log(`🔒 Processing compliance task: ${task.type}`);

    const characterInfo = task.characterInfo;
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
            await this.flagProject(project, "High similarity detected");
          }
          result = {
            complianceResults,
            count: complianceResults.length,
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

  async getSimilarProjects(payload: {
    projectId: string;
    ownerAddress: string;
  }): Promise<NillionComplianceProject[]> {
    // Get all compliance records for this project
    const complianceRecords = await fetchCompliance();
    const projectRecords = complianceRecords.filter(
      (record) => record.project_id === payload.projectId
    );

    return projectRecords.map(this.mapComplianceDataToProject);
  }

  async searchSimilarProjects(payload: {
    projectId: string;
    searchTerm: string;
    ownerAddress: string;
    sources?: string[];
  }): Promise<NillionComplianceProject[]> {
    // Create a mock project for targeted search
    const mockProject = {
      projectId: payload.projectId,
      name: payload.searchTerm,
      description: `Search for projects similar to: ${payload.searchTerm}`,
    };

    return await this.complianceScraper.scrapeProjects(
      mockProject,
      payload.sources || ["all"],
      50
    );
  }

  async checkNewProjectCompliance(payload: {
    projectId: string;
    projectName: string;
    description: string;
    ownerAddress: string;
    sources?: string[];
    maxResults?: number;
  }): Promise<NillionComplianceProject[]> {
    console.log(`🔍 Starting compliance check for: ${payload.projectName}`);

    return await this.scanSimilarProjects({
      projectId: payload.projectId,
      projectName: payload.projectName,
      description: payload.description,
      ownerAddress: payload.ownerAddress,
      sources: payload.sources || ["all"],
      maxResults: payload.maxResults || 50,
    });
  }

  async scanSimilarProjects(payload: {
    projectId: string;
    projectName: string;
    description: string;
    ownerAddress: string;
    sources?: string[];
    maxResults?: number;
  }): Promise<NillionComplianceProject[]> {
    console.log(`🔒 Scanning for similar projects to: ${payload.projectName}`);

    const project = {
      projectId: payload.projectId,
      name: payload.projectName,
      description: payload.description,
    };

    // Scrape similar projects
    const discoveredProjects = await this.complianceScraper.scrapeProjects(
      project,
      payload.sources || ["all"],
      payload.maxResults || 50
    );

    // Analyze similarity for each project and store in Nillion
    const analyzedProjects: NillionComplianceProject[] = [];
    for (const complianceProject of discoveredProjects) {
      const similarity = await this.calculateSimilarity(
        project,
        complianceProject
      );
      const analyzedProject = { ...complianceProject, similarity };

      // Store in Nillion compliance collection
      await this.storeComplianceProject(analyzedProject, payload.ownerAddress);
      analyzedProjects.push(analyzedProject);
    }

    console.log(
      `✅ Found and analyzed ${analyzedProjects.length} similar projects`
    );
    return analyzedProjects.sort((a, b) => b.similarity - a.similarity);
  }

  private async calculateSimilarity(
    originalProject: any,
    complianceProject: NillionComplianceProject
  ): Promise<number> {
    const prompt = `
Compare these two projects and calculate similarity (0-100):

Original Project:
- Name: ${originalProject.name}
- Description: ${originalProject.description}

Comparison Project:
- Name: ${complianceProject.projectName}
- Description: ${complianceProject.description}
- Platform: ${complianceProject.platform}
- Tags: ${complianceProject.tags.join(", ")}

Analyze similarity based on:
1. Name similarity (exact matches, similar words)
2. Description/concept similarity
3. Technical approach/implementation
4. Overall functionality and purpose
5. Unique features vs common features

Return only a number between 0-100 representing similarity percentage.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const similarity = parseInt(content.match(/\d+/)?.[0] || "50");
      return Math.max(0, Math.min(100, similarity));
    } catch (error) {
      console.error("Error calculating similarity:", error);
      return 50;
    }
  }

  async analyzeSimilarity(payload: {
    complianceId: string;
    ownerAddress: string;
  }): Promise<any> {
    const allCompliance = await fetchComplianceByAddress(payload.ownerAddress);
    const complianceProject = allCompliance.find((c) =>
      c.data.includes(payload.complianceId)
    );

    if (!complianceProject) {
      throw new Error(`Compliance record not found: ${payload.complianceId}`);
    }

    const projectData = JSON.parse(complianceProject.data);
    const prompt = `
Provide detailed similarity analysis between these projects:

Original Project:
- Name: ${projectData.originalProjectName}
- Description: ${projectData.originalDescription}

Similar Project Found:
- Name: ${projectData.projectName}
- Description: ${projectData.description}
- Platform: ${projectData.platform}
- URL: ${projectData.url}
- Similarity Score: ${projectData.similarity}%

Provide detailed analysis:
1. What makes them similar?
2. Key differences
3. Potential compliance concerns
4. Recommendation (flag, investigate, clear)
5. Specific areas of concern

Format as JSON with fields: similarities, differences, concerns, recommendation, riskLevel
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

      const analysis = JSON.parse(content);

      // Update compliance record with analysis
      const updatedData = { ...projectData, analysis };
      await pushCompliance({
        name: complianceProject.name,
        project_id: complianceProject.project_id,
        owner_address: complianceProject.owner_address,
        source: complianceProject.source,
        data: JSON.stringify(updatedData),
      });

      return analysis;
    } catch (error) {
      console.error("Error analyzing similarity:", error);
      return {
        similarities: ["Unable to analyze"],
        differences: ["Analysis failed"],
        concerns: ["Manual review required"],
        recommendation: "investigate",
        riskLevel: "unknown",
      };
    }
  }

  async reviewCompliance(payload: {
    complianceId: string;
    ownerAddress: string;
    action: "flag" | "clear" | "investigate";
    reason?: string;
  }): Promise<any> {
    const allCompliance = await fetchComplianceByAddress(payload.ownerAddress);
    const complianceProject = allCompliance.find((c) =>
      c.data.includes(payload.complianceId)
    );

    if (!complianceProject) {
      throw new Error(`Compliance record not found: ${payload.complianceId}`);
    }

    const projectData = JSON.parse(complianceProject.data);
    const updatedData = {
      ...projectData,
      status:
        payload.action === "flag"
          ? "flagged"
          : payload.action === "clear"
          ? "cleared"
          : "reviewed",
      reviewedAt: new Date().toISOString(),
      flagReason: payload.action === "flag" ? payload.reason : undefined,
    };

    await pushCompliance({
      name: complianceProject.name,
      project_id: complianceProject.project_id,
      owner_address: complianceProject.owner_address,
      source: complianceProject.source,
      data: JSON.stringify(updatedData),
    });

    // If flagged, notify via logs
    if (payload.action === "flag") {
      await this.notifyComplianceIssue(projectData, payload.ownerAddress);
    }

    return {
      complianceId: payload.complianceId,
      action: payload.action,
      status: updatedData.status,
      reviewedAt: updatedData.reviewedAt,
    };
  }

  private async flagProject(
    project: NillionComplianceProject,
    reason: string
  ): Promise<void> {
    console.log(`🚩 Auto-flagging project: ${project.projectName} - ${reason}`);

    const projectData = {
      ...project,
      status: "flagged",
      flagReason: reason,
      reviewedAt: new Date().toISOString(),
    };

    await pushCompliance({
      name: `Flagged: ${project.projectName}`,
      project_id: project.originalProjectId || "unknown",
      owner_address: project.ownerAddress || "unknown",
      source: "auto-flag",
      data: JSON.stringify(projectData),
    });

    await this.notifyComplianceIssue(projectData, project.ownerAddress || "");
  }

  private async notifyComplianceIssue(
    project: any,
    ownerAddress: string
  ): Promise<void> {
    try {
      await pushLogs({
        owner_address: ownerAddress,
        project_id: project.originalProjectId || "unknown",
        agent_name: this.agentName,
        text: `Compliance issue detected: ${project.projectName} flagged for ${project.flagReason}`,
        data: JSON.stringify({
          type: "COMPLIANCE_ALERT",
          taskId: randomUUID(),
          workflowId: randomUUID(),
          payload: {
            projectName: project.originalProjectName,
            similarProject: {
              name: project.projectName,
              platform: project.platform,
              url: project.url,
              similarity: project.similarity,
              reason: project.flagReason,
              discoveredAt: project.discoveredAt,
            },
          },
        }),
      });

      console.log(`✅ Compliance alert logged for ${project.projectName}`);
    } catch (error) {
      console.error("Failed to log compliance alert:", error);
    }
  }

  private async storeComplianceProject(
    project: NillionComplianceProject,
    ownerAddress: string
  ): Promise<void> {
    await pushCompliance({
      name: project.projectName,
      project_id: project.originalProjectId || "discovered",
      owner_address: ownerAddress,
      source: project.source || project.platform,
      data: JSON.stringify(project),
    });
  }

  private mapComplianceDataToProject(
    data: ComplianceData
  ): NillionComplianceProject {
    const projectData = JSON.parse(data.data);
    return {
      complianceId: projectData.complianceId || randomUUID(),
      originalProjectId: data.project_id,
      projectName: data.name,
      description: projectData.description || "",
      url: projectData.url || "",
      platform: projectData.platform || data.source,
      tags: projectData.tags || [],
      similarity: projectData.similarity || 0,
      status: projectData.status || "pending_review",
      source: data.source,
      discoveredAt: projectData.discoveredAt || new Date().toISOString(),
      ownerAddress: data.owner_address,
      metadata: projectData.metadata || {},
    };
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    result: any,
    error?: string,
    characterResponse?: string
  ) {
    try {
      await pushLogs({
        owner_address: "system",
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
            agent: "compliance",
          },
        }),
      });
    } catch (err) {
      console.error("Failed to report task completion:", err);
    }
  }
}

// Update the compliance project interface to match Nillion structure
interface NillionComplianceProject {
  complianceId: string;
  originalProjectId: string;
  projectName: string;
  description: string;
  url: string;
  platform: string;
  hackathon?: string;
  tags: string[];
  similarity: number;
  status: string;
  source: string;
  discoveredAt: string;
  ownerAddress?: string;
  metadata: any;
  flagReason?: string;
  reviewedAt?: string;
}
