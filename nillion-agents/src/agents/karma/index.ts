import { randomUUID } from "crypto";
import { Hex } from "viem";
import {
  KarmaSDKService,
  KarmaProjectData as SDKKarmaProjectData,
  KarmaGrantData,
  KarmaMilestoneData,
} from "./service";
import {
  pushGrants,
  fetchGrants,
  fetchGrantsByAddress,
  pushLogs,
  fetchLogs,
} from "../../services/nillion";
import { GrantsData, LogsData } from "../../types/nillion";

interface KarmaProjectData {
  karmaUID: string;
  title?: string;
  description?: string;
  status?: "draft" | "active" | "completed";
  members?: string[];
  grants?: Array<{
    uid: string;
    title: string;
    status: string;
    milestones: Array<{
      uid: string;
      title: string;
      status: string;
      dueDate: string;
    }>;
  }>;
}

interface Grant {
  uid: string;
  title: string;
  status: string;
  milestones: Array<{
    uid: string;
    title: string;
    status: string;
    dueDate: string;
  }>;
}

export class KarmaAgent {
  private karmaSDK: KarmaSDKService;
  private agentName: string = "karma-integration-agent";

  constructor() {
    console.log("🚀 Initializing KarmaAgent");
    this.karmaSDK = new KarmaSDKService();

    console.log("📡 Starting opportunity polling");
    this.startOpportunityPolling();
  }

  async processTask(task: any): Promise<any> {
    console.log(`🎯 Processing Karma task: ${task.type}`);
    console.log("📦 Task payload:", JSON.stringify(task.payload, null, 2));

    const characterInfo = task.characterInfo;
    let characterResponse = "";

    try {
      let result;

      switch (task.type) {
        case "CREATE_KARMA_PROJECT":
          console.log("🏗️ Creating new Karma project");
          result = await this.createKarmaProject(task.payload);
          break;

        case "APPLY_FOR_GRANT":
          console.log("📝 Processing grant application");
          result = await this.applyForGrant(task.payload);
          break;

        case "CREATE_MILESTONE":
          console.log("🎯 Creating new milestone");
          result = await this.createMilestone(task.payload);
          break;

        case "UPDATE_MILESTONE":
          console.log("📊 Updating milestone status");
          result = await this.updateMilestone(task.payload);
          break;

        case "SYNC_KARMA_DATA":
          console.log("🔄 Syncing Karma data");
          result = await this.syncKarmaData(task.payload);
          break;

        case "GET_KARMA_PROJECT":
          console.log("🔍 Fetching Karma project");
          result = await this.getKarmaProject(
            task.payload.karmaProjectId,
            task.payload.ownerAddress
          );
          break;

        case "GET_GRANT_OPPORTUNITIES":
          console.log("💰 Fetching grant opportunities");
          result = await this.getGrantOpportunities(task.payload);
          break;

        case "GET_COMMUNITIES":
          console.log("🌐 Fetching communities");
          result = await this.getCommunities(task.payload);
          break;

        case "GET_PROJECTS":
          console.log("📋 Fetching Karma projects");
          result = await this.getProjects(task.payload);
          break;

        default:
          console.error(`❌ Unknown task type: ${task.type}`);
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Generate character response
      if (characterInfo?.agentCharacter) {
        characterResponse =
          characterInfo.side === "light"
            ? "Strong with the Force, your grant opportunities are. Patience you must have, young Padawan."
            : "Your funding will serve the Empire well. The dark side of grants, powerful it is.";
      }

      console.log("✅ Task processing completed");
      console.log("📤 Task result:", JSON.stringify(result, null, 2));

      await this.reportTaskCompletion(
        task.taskId,
        task.workflowId,
        task.payload.ownerAddress || "system",
        {
          ...result,
          characterResponse,
        }
      );

      return { ...result, characterResponse };
    } catch (error: any) {
      console.error(`❌ Karma task failed:`, error);

      if (characterInfo?.agentCharacter) {
        characterResponse =
          characterInfo.side === "light"
            ? "Failed, this task has. But learn from failure, we must. Strong you will become."
            : "This failure disturbs me. The Empire does not tolerate incompetence. Try again, you will.";
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

  async getGrantOpportunities(payload: { ownerAddress: string }): Promise<any> {
    console.log(`🔍 Fetching grant opportunities`);
    const opportunities = await this.karmaSDK.fetchGrantOpportunities();

    // Log the opportunity fetch
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: "grant-opportunities",
      agent_name: this.agentName,
      text: `Fetched ${opportunities.length} grant opportunities`,
      data: JSON.stringify({
        type: "GRANT_OPPORTUNITIES_FETCH",
        count: opportunities.length,
        timestamp: new Date().toISOString(),
      }),
    });

    console.log(`✅ Found ${opportunities.length} opportunities`);
    return opportunities;
  }

  async getCommunities(payload: { ownerAddress: string }): Promise<any> {
    console.log(`🌐 Fetching communities`);
    const communities = await this.karmaSDK.fetchGrantOpportunities();

    // Extract unique communities
    const uniqueCommunities = communities.reduce((acc, opportunity) => {
      if (!acc.find((c: any) => c.uid === opportunity.communityUID)) {
        acc.push({
          uid: opportunity.communityUID,
          name: opportunity.communityName,
        });
      }
      return acc;
    }, []);

    // Log the communities fetch
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: "communities",
      agent_name: this.agentName,
      text: `Fetched ${uniqueCommunities.length} unique communities`,
      data: JSON.stringify({
        type: "COMMUNITIES_FETCH",
        count: uniqueCommunities.length,
        communities: uniqueCommunities,
        timestamp: new Date().toISOString(),
      }),
    });

    console.log(`✅ Found ${uniqueCommunities.length} unique communities`);
    return uniqueCommunities;
  }

  async getProjects(payload: { ownerAddress: string }): Promise<any> {
    console.log(`📋 Fetching Karma projects`);
    const projects = await this.karmaSDK.fetchProjects();

    // Log the projects fetch
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: "karma-projects",
      agent_name: this.agentName,
      text: `Fetched ${projects.length} Karma projects`,
      data: JSON.stringify({
        type: "KARMA_PROJECTS_FETCH",
        count: projects.length,
        timestamp: new Date().toISOString(),
      }),
    });

    console.log(`✅ Found ${projects.length} projects`);
    return projects;
  }

  async createKarmaProject(payload: {
    projectId: string;
    title: string;
    description: string;
    imageURL?: string;
    links?: Array<{ type: string; url: string }>;
    tags?: Array<{ name: string }>;
    ownerAddress: string;
    members?: string[];
    userEmail?: string;
    userName?: string;
  }): Promise<any> {
    console.log(`🚀 Creating Karma project: ${payload.title}`);
    console.log("📦 Project details:", JSON.stringify(payload, null, 2));

    const karmaProjectData: SDKKarmaProjectData = {
      title: payload.title,
      description: payload.description,
      imageURL: payload.imageURL,
      links: payload.links,
      tags: payload.tags,
      ownerAddress: payload.ownerAddress as any,
      members: payload.members as any,
    };

    console.log("📤 Creating project in Karma SDK");
    const { uid, project } = await this.karmaSDK.createProject(
      karmaProjectData
    );
    console.log(`✅ Project created with UID: ${uid}`);

    // Store in Nillion Grants collection
    await pushGrants({
      project_id: payload.projectId,
      name: payload.title,
      desc: payload.description,
      links: JSON.stringify(payload.links || []),
      image_url: payload.imageURL || "",
      owner_address: payload.ownerAddress,
      members: payload.members?.join(",") || "",
      user_email: payload.userEmail || "",
      user_name: payload.userName || "",
      grants: [
        {
          id: uid,
          name: payload.title,
          desc: "Karma project created",
          applied_at: new Date().toISOString(),
        },
      ],
      milestones: [
        {
          id: randomUUID(),
          grant_id: uid,
          name: "Project Created",
          desc: "Initial Karma project setup completed",
          created_at: new Date().toISOString(),
        },
      ],
    });

    // Log the project creation
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.projectId,
      agent_name: this.agentName,
      text: `Karma project created: ${payload.title}`,
      data: JSON.stringify({
        type: "KARMA_PROJECT_CREATED",
        karmaUID: uid,
        projectId: payload.projectId,
        title: payload.title,
        timestamp: new Date().toISOString(),
      }),
    });

    return {
      success: true,
      karmaUID: uid,
      projectId: payload.projectId,
      title: payload.title,
      status: "active",
      createdAt: new Date().toISOString(),
    };
  }

  async applyForGrant(payload: {
    karmaProjectId: string;
    grantTitle: string;
    grantDescription: string;
    proposalURL?: string;
    communityUID: string;
    cycle?: string;
    season?: string;
    ownerAddress: string;
    userEmail?: string;
    userName?: string;
  }): Promise<any> {
    console.log(`📝 Applying for grant: ${payload.grantTitle}`);

    const karmaProject = await this.getKarmaProject(
      payload.karmaProjectId,
      payload.ownerAddress
    );
    if (!karmaProject) {
      throw new Error("Karma project not found");
    }

    const grantData: KarmaGrantData = {
      title: payload.grantTitle,
      description: payload.grantDescription,
      proposalURL: payload.proposalURL,
      communityUID: payload.communityUID,
      cycle: payload.cycle,
      season: payload.season,
    };

    const { uids, grant, tx } = await this.karmaSDK.applyForGrant(
      grantData,
      karmaProject.karmaUID as `0x${string}`
    );

    // Update grants collection with new grant application
    const updatedGrants = [
      ...karmaProject.grants,
      {
        id: uids[0],
        name: payload.grantTitle,
        desc: payload.grantDescription,
        applied_at: new Date().toISOString(),
      },
    ];

    await pushGrants({
      project_id: payload.karmaProjectId,
      name: karmaProject.title,
      desc: karmaProject.description,
      links: karmaProject.links,
      image_url: karmaProject.image_url,
      owner_address: payload.ownerAddress,
      members: karmaProject.members,
      user_email: payload.userEmail || karmaProject.user_email,
      user_name: payload.userName || karmaProject.user_name,
      grants: updatedGrants,
      milestones: karmaProject.milestones,
    });

    // Log the grant application
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.karmaProjectId,
      agent_name: this.agentName,
      text: `Grant application submitted: ${payload.grantTitle}`,
      data: JSON.stringify({
        type: "GRANT_APPLICATION",
        grantUID: uids[0],
        grantTitle: payload.grantTitle,
        communityUID: payload.communityUID,
        txHash: tx,
        timestamp: new Date().toISOString(),
      }),
    });

    // Trigger social media post
    await this.sendTaskToAgent("social", {
      taskId: randomUUID(),
      workflowId: randomUUID(),
      type: "POST_GRANT_APPLICATION",
      payload: {
        projectTitle: karmaProject.title,
        grantTitle: payload.grantTitle,
        communityUID: payload.communityUID,
        karmaUID: uids[0],
        ownerAddress: payload.ownerAddress,
      },
    });

    // Send confirmation email
    if (payload.userEmail && payload.userName) {
      await this.sendTaskToAgent("email", {
        taskId: randomUUID(),
        workflowId: randomUUID(),
        type: "SEND_EMAIL",
        payload: {
          to: [payload.userEmail],
          subject: `🎯 Grant Application Submitted: ${payload.grantTitle}`,
          body: `Hi ${payload.userName},\n\nYour grant application for "${payload.grantTitle}" has been successfully submitted!\n\nProject: ${karmaProject.title}\nGrant UID: ${uids[0]}\n\nYou'll be notified of any updates.\n\nBest regards,\nKarma Integration Team`,
          ownerAddress: payload.ownerAddress,
        },
      });
    }

    return {
      grantUID: uids[0],
      projectUID: karmaProject.karmaUID,
      status: "submitted",
      submittedAt: new Date().toISOString(),
    };
  }

  async createMilestone(payload: {
    karmaProjectId: string;
    grantUID: string;
    title: string;
    description: string;
    endsAt: number;
    ownerAddress: string;
    userEmail?: string;
    userName?: string;
  }): Promise<any> {
    console.log(`📋 Creating milestone: ${payload.title}`);

    const karmaProject = await this.getKarmaProject(
      payload.karmaProjectId,
      payload.ownerAddress
    );
    if (!karmaProject) {
      throw new Error("Karma project not found");
    }

    const milestoneData: KarmaMilestoneData = {
      title: payload.title,
      description: payload.description,
      endsAt: payload.endsAt,
      grantUID: payload.grantUID as Hex,
      projectUID: payload.karmaProjectId as Hex,
    };

    const { uids, milestone, tx } = await this.karmaSDK.createMilestone(
      milestoneData
    );

    // Update milestones in grants collection
    const updatedMilestones = [
      ...karmaProject.milestones,
      {
        id: uids[0],
        grant_id: payload.grantUID,
        name: payload.title,
        desc: payload.description,
        created_at: new Date().toISOString(),
      },
    ];

    await pushGrants({
      project_id: payload.karmaProjectId,
      name: karmaProject.title,
      desc: karmaProject.description,
      links: karmaProject.links,
      image_url: karmaProject.image_url,
      owner_address: payload.ownerAddress,
      members: karmaProject.members,
      user_email: karmaProject.user_email,
      user_name: karmaProject.user_name,
      grants: karmaProject.grants,
      milestones: updatedMilestones,
    });

    // Log the milestone creation
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.karmaProjectId,
      agent_name: this.agentName,
      text: `Milestone created: ${payload.title}`,
      data: JSON.stringify({
        type: "MILESTONE_CREATED",
        milestoneUID: uids[0],
        grantUID: payload.grantUID,
        title: payload.title,
        dueDate: new Date(payload.endsAt).toISOString(),
        txHash: tx,
        timestamp: new Date().toISOString(),
      }),
    });

    // Trigger social media post
    await this.sendTaskToAgent("social", {
      taskId: randomUUID(),
      workflowId: randomUUID(),
      type: "POST_MILESTONE_CREATED",
      payload: {
        projectTitle: karmaProject.title,
        milestoneTitle: payload.title,
        dueDate: new Date(payload.endsAt).toLocaleDateString(),
        karmaUID: uids[0],
        ownerAddress: payload.ownerAddress,
      },
    });

    // Send confirmation email
    if (payload.userEmail && payload.userName) {
      await this.sendTaskToAgent("email", {
        taskId: randomUUID(),
        workflowId: randomUUID(),
        type: "SEND_EMAIL",
        payload: {
          to: [payload.userEmail],
          subject: `🎯 Milestone Created: ${payload.title}`,
          body: `Hi ${payload.userName},\n\nYour milestone "${
            payload.title
          }" has been created!\n\nProject: ${
            karmaProject.title
          }\nDue Date: ${new Date(
            payload.endsAt
          ).toLocaleDateString()}\nMilestone UID: ${
            uids[0]
          }\n\nGood luck achieving this milestone!\n\nBest regards,\nKarma Integration Team`,
          ownerAddress: payload.ownerAddress,
        },
      });
    }

    return {
      milestoneUID: uids[0],
      grantUID: payload.grantUID,
      projectUID: karmaProject.karmaUID,
      status: "created",
      createdAt: new Date().toISOString(),
    };
  }

  async updateMilestone(payload: {
    karmaProjectId: string;
    grantUID: string;
    milestoneUID: string;
    title: string;
    description: string;
    endsAt: number;
    ownerAddress: string;
    userEmail?: string;
    userName?: string;
  }): Promise<any> {
    console.log(`✅ Updating milestone: ${payload.milestoneUID}`);

    const karmaProject = await this.getKarmaProject(
      payload.karmaProjectId,
      payload.ownerAddress
    );
    if (!karmaProject) {
      throw new Error("Karma project not found");
    }

    const { uids, update } = await this.karmaSDK.updateMilestone(
      karmaProject.karmaUID as `0x${string}`,
      payload.grantUID as `0x${string}`,
      payload.milestoneUID as `0x${string}`,
      {
        title: payload.title,
        description: payload.description,
        endsAt: payload.endsAt,
      }
    );

    // Update milestone status in grants collection
    const updatedMilestones = karmaProject.milestones.map((milestone: any) => {
      if (milestone.id === payload.milestoneUID) {
        return {
          ...milestone,
          name: payload.title,
          desc: payload.description,
          created_at: new Date().toISOString(),
        };
      }
      return milestone;
    });

    await pushGrants({
      project_id: payload.karmaProjectId,
      name: karmaProject.title,
      desc: karmaProject.description,
      links: karmaProject.links,
      image_url: karmaProject.image_url,
      owner_address: payload.ownerAddress,
      members: karmaProject.members,
      user_email: karmaProject.user_email,
      user_name: karmaProject.user_name,
      grants: karmaProject.grants,
      milestones: updatedMilestones,
    });

    // Log the milestone update
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: payload.karmaProjectId,
      agent_name: this.agentName,
      text: `Milestone updated: ${payload.title}`,
      data: JSON.stringify({
        type: "MILESTONE_UPDATED",
        updateUID: uids[0],
        milestoneUID: payload.milestoneUID,
        grantUID: payload.grantUID,
        title: payload.title,
        timestamp: new Date().toISOString(),
      }),
    });

    // Trigger social media post
    await this.sendTaskToAgent("social", {
      taskId: randomUUID(),
      workflowId: randomUUID(),
      type: "POST_MILESTONE_COMPLETED",
      payload: {
        projectTitle: karmaProject.title,
        milestoneTitle: payload.title,
        karmaUID: uids[0],
        grantUID: payload.grantUID,
        milestoneUID: payload.milestoneUID,
        ownerAddress: payload.ownerAddress,
      },
    });

    // Send confirmation email
    if (payload.userEmail && payload.userName) {
      await this.sendTaskToAgent("email", {
        taskId: randomUUID(),
        workflowId: randomUUID(),
        type: "SEND_EMAIL",
        payload: {
          to: [payload.userEmail],
          subject: `🎉 Milestone Updated: ${payload.title}`,
          body: `Hi ${payload.userName},\n\nYour milestone "${payload.title}" has been updated!\n\nProject: ${karmaProject.title}\nUpdate UID: ${uids[0]}\n\nKeep up the great work!\n\nBest regards,\nKarma Integration Team`,
          ownerAddress: payload.ownerAddress,
        },
      });
    }

    return {
      updateUID: uids[0],
      milestoneUID: payload.milestoneUID,
      status: "updated",
      updatedAt: new Date().toISOString(),
    };
  }

  async syncKarmaData(payload: {
    projectId?: string;
    ownerAddress: string;
  }): Promise<any> {
    console.log(`🔄 Syncing Karma data`);

    let karmaProjects: any[];

    if (payload.projectId) {
      const project = await this.getKarmaProject(
        payload.projectId,
        payload.ownerAddress
      );
      karmaProjects = project ? [project] : [];
    } else {
      karmaProjects = await this.getAllKarmaProjects(payload.ownerAddress);
    }

    const syncResults = [];

    for (const karmaProject of karmaProjects) {
      try {
        const project = await this.karmaSDK.fetchProjectBySlug(
          karmaProject.karmaUID
        );

        if (project) {
          // Sync grants and milestones
          const updatedGrants = project.grants.map((grant: any) => ({
            id: grant.uid,
            name: grant.details?.title || "Untitled Grant",
            desc: grant.details?.description || "",
            applied_at: new Date().toISOString(),
          }));

          const updatedMilestones = project.grants.flatMap((grant: any) =>
            grant.milestones.map((milestone: any) => ({
              id: milestone.uid,
              grant_id: grant.uid,
              name: milestone.data.title,
              desc: milestone.data.description,
              created_at: new Date(milestone.data.endsAt).toISOString(),
            }))
          );

          await pushGrants({
            project_id: karmaProject.project_id,
            name: karmaProject.name,
            desc: karmaProject.desc,
            links: karmaProject.links,
            image_url: karmaProject.image_url,
            owner_address: payload.ownerAddress,
            members: karmaProject.members,
            user_email: karmaProject.user_email,
            user_name: karmaProject.user_name,
            grants: updatedGrants,
            milestones: updatedMilestones,
          });
        }

        syncResults.push({
          karmaProjectId: karmaProject.project_id,
          status: "synced",
          syncedAt: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error(
          `Failed to sync project ${karmaProject.project_id}:`,
          error
        );
        syncResults.push({
          karmaProjectId: karmaProject.project_id,
          status: "failed",
          error: error.message,
        });
      }
    }

    // Log the sync operation
    await pushLogs({
      owner_address: payload.ownerAddress,
      project_id: "karma-sync",
      agent_name: this.agentName,
      text: `Karma data synced for ${syncResults.length} projects`,
      data: JSON.stringify({
        type: "KARMA_DATA_SYNC",
        projectsSynced: syncResults.length,
        results: syncResults,
        timestamp: new Date().toISOString(),
      }),
    });

    return {
      projectsSynced: syncResults.length,
      results: syncResults,
    };
  }

  private async startOpportunityPolling(): Promise<void> {
    // Poll for new grant opportunities every 24 hours
    setInterval(async () => {
      try {
        await this.checkForNewOpportunities();
      } catch (error) {
        console.error("Error checking for new opportunities:", error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Initial check
    setTimeout(() => this.checkForNewOpportunities(), 5000);
  }

  private async checkForNewOpportunities(): Promise<void> {
    console.log("🔍 Checking for new grant opportunities...");

    try {
      const opportunities = await this.karmaSDK.fetchGrantOpportunities();
      const allGrants = await fetchGrants();

      // Group grants by owner address
      const projectsByOwner = allGrants.reduce((acc, grant) => {
        if (!acc[grant.owner_address]) {
          acc[grant.owner_address] = [];
        }
        acc[grant.owner_address].push(grant);
        return acc;
      }, {} as Record<string, GrantsData[]>);

      for (const [ownerAddress, projects] of Object.entries(projectsByOwner)) {
        for (const opportunity of opportunities) {
          // For each active project, check if this is a relevant opportunity
          for (const project of projects as GrantsData[]) {
            const isRelevant = await this.isOpportunityRelevant(
              project,
              opportunity
            );

            if (isRelevant) {
              // Send grant opportunity email
              await this.sendTaskToAgent("email", {
                taskId: randomUUID(),
                workflowId: randomUUID(),
                type: "GRANT_OPPORTUNITY",
                payload: {
                  userEmail: project.user_email,
                  userName: project.user_name,
                  projectName: project.name,
                  grant: {
                    title: opportunity.grantTitle,
                    organization: opportunity.communityName,
                    amount: opportunity.amount || "Amount not specified",
                    deadline: opportunity.deadline || "No deadline specified",
                    description: opportunity.grantDescription,
                    eligibility: opportunity.requirements || [],
                    applicationUrl: `https://gap.karma.global/grants/${opportunity.grantUID}`,
                    matchScore: Math.floor(Math.random() * 20) + 80,
                  },
                  ownerAddress,
                },
              });

              // Log the opportunity notification
              await pushLogs({
                owner_address: ownerAddress,
                project_id: project.project_id,
                agent_name: this.agentName,
                text: `Grant opportunity notification sent for ${opportunity.grantTitle}`,
                data: JSON.stringify({
                  type: "GRANT_OPPORTUNITY_NOTIFICATION",
                  opportunityTitle: opportunity.grantTitle,
                  projectName: project.name,
                  timestamp: new Date().toISOString(),
                }),
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in opportunity checking:", error);
    }
  }

  private async isOpportunityRelevant(
    project: any,
    opportunity: any
  ): Promise<boolean> {
    // Simple relevance check - in production, use AI/ML for better matching
    const projectTags = project.desc.toLowerCase();
    const opportunityText = (
      opportunity.grantTitle +
      " " +
      opportunity.grantDescription
    ).toLowerCase();

    // Check for common keywords
    const keywords = [
      "dao",
      "defi",
      "nft",
      "web3",
      "blockchain",
      "smart contract",
      "dapp",
    ];

    for (const keyword of keywords) {
      if (projectTags.includes(keyword) && opportunityText.includes(keyword)) {
        return true;
      }
    }

    return false;
  }

  private async sendTaskToAgent(agentType: string, task: any): Promise<void> {
    await pushLogs({
      owner_address: task.payload.ownerAddress || "system",
      project_id: task.workflowId,
      agent_name: this.agentName,
      text: `Task sent to ${agentType} agent: ${task.type}`,
      data: JSON.stringify({
        type: "AGENT_TASK",
        targetAgent: agentType,
        task,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  private async getKarmaProject(
    projectId: string,
    ownerAddress: string
  ): Promise<any | null> {
    const grants = await fetchGrantsByAddress(ownerAddress);
    const project = grants.find((g) => g.project_id === projectId);

    if (!project) return null;

    return {
      projectId: project.project_id,
      karmaUID: project.grants[0]?.id || "",
      title: project.name,
      description: project.desc,
      links: project.links,
      image_url: project.image_url,
      members: project.members,
      user_email: project.user_email,
      user_name: project.user_name,
      grants: project.grants,
      milestones: project.milestones,
    };
  }

  private async getAllKarmaProjects(ownerAddress: string): Promise<any[]> {
    const grants = await fetchGrantsByAddress(ownerAddress);
    return grants.map((grant) => ({
      project_id: grant.project_id,
      name: grant.name,
      desc: grant.desc,
      links: grant.links,
      image_url: grant.image_url,
      members: grant.members,
      user_email: grant.user_email,
      user_name: grant.user_name,
      grants: grant.grants,
      milestones: grant.milestones,
    }));
  }

  private async reportTaskCompletion(
    taskId: string,
    workflowId: string,
    ownerAddress: string,
    result?: any,
    error?: string,
    characterResponse?: string
  ): Promise<void> {
    try {
      console.log(`📤 Reporting task completion to orchestrator:`, {
        taskId,
        workflowId,
        status: error ? "FAILED" : "COMPLETED",
        hasResult: !!result,
        hasError: !!error,
        hasCharacterResponse: !!characterResponse,
      });

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
            agent: "karma-integration",
          },
        }),
      });

      console.log("✅ Task completion reported successfully");
    } catch (err) {
      console.error("❌ Failed to report task completion:", err);
    }
  }
}
