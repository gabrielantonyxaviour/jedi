import dotenv from "dotenv";
dotenv.config();

import { ServiceFactory } from "../services/index.js";

async function runAnalytics() {
  console.log("📊 Running Multi-Agent System Analytics...\n");

  try {
    const logsService = ServiceFactory.getLogs();
    const githubService = ServiceFactory.getGithub();
    const leadsService = ServiceFactory.getLeads();
    const storiesService = ServiceFactory.getStories();
    const socialsService = ServiceFactory.getSocials();
    const grantsService = ServiceFactory.getGrants();
    const complianceService = ServiceFactory.getCompliance();

    console.log("=== SYSTEM OVERVIEW ===");

    // Basic counts
    const logCount = (await logsService.findAll()).length;
    const projectCount = (await githubService.findAll()).length;
    const leadCount = (await leadsService.findAll()).length;
    const storyCount = (await storiesService.findAll()).length;
    const socialCount = (await socialsService.findAll()).length;
    const grantCollectionCount = (await grantsService.findAll()).length;
    const complianceCount = (await complianceService.findAll()).length;

    console.log(`📝 Total Agent Logs: ${logCount}`);
    console.log(`🐙 GitHub Projects: ${projectCount}`);
    console.log(`🎯 Leads: ${leadCount}`);
    console.log(`📚 Stories: ${storyCount}`);
    console.log(`📱 Social Accounts: ${socialCount}`);
    console.log(`💰 Grant Collections: ${grantCollectionCount}`);
    console.log(`📋 Compliance Records: ${complianceCount}`);

    console.log("\n=== AGENT ACTIVITY ANALYTICS ===");

    // Agent activity breakdown
    const allLogs = await logsService.findAll();
    const agentActivity: Record<string, number> = {};

    allLogs.forEach((log) => {
      agentActivity[log.agentName] = (agentActivity[log.agentName] || 0) + 1;
    });

    console.log("Agent Activity Summary:");
    Object.entries(agentActivity)
      .sort(([, a], [, b]) => b - a)
      .forEach(([agent, count]) => {
        console.log(`  ${agent}: ${count} actions`);
      });

    console.log("\n=== GITHUB PROJECTS ANALYTICS ===");

    const allProjects = await githubService.findAll();
    if (allProjects.length > 0) {
      // Language distribution
      const languages: Record<string, number> = {};
      const frameworks: Record<string, number> = {};
      let totalStars = 0;

      allProjects.forEach((project) => {
        const lang = project.metadata.language;
        const framework = project.metadata.framework;
        const stars = project.metadata.stars || 0;

        if (lang) languages[lang] = (languages[lang] || 0) + 1;
        if (framework) frameworks[framework] = (frameworks[framework] || 0) + 1;
        totalStars += stars;
      });

      console.log("Programming Languages:");
      Object.entries(languages).forEach(([lang, count]) => {
        console.log(`  ${lang}: ${count} projects`);
      });

      console.log("Frameworks:");
      Object.entries(frameworks).forEach(([fw, count]) => {
        console.log(`  ${fw}: ${count} projects`);
      });

      console.log(
        `Average Stars per Project: ${(totalStars / allProjects.length).toFixed(
          1
        )}`
      );
    }

    console.log("\n=== LEADS ANALYTICS ===");

    const allLeads = await leadsService.findAll();
    if (allLeads.length > 0) {
      // Source distribution
      const sources: Record<string, number> = {};
      const industries: Record<string, number> = {};
      const interestLevels: Record<string, number> = {};

      allLeads.forEach((lead) => {
        sources[lead.source] = (sources[lead.source] || 0) + 1;

        const industry = lead.metadata.industry;
        const interest = lead.metadata.interest_level;

        if (industry) industries[industry] = (industries[industry] || 0) + 1;
        if (interest)
          interestLevels[interest] = (interestLevels[interest] || 0) + 1;
      });

      console.log("Lead Sources:");
      Object.entries(sources).forEach(([source, count]) => {
        console.log(`  ${source}: ${count} leads`);
      });

      console.log("Industries:");
      Object.entries(industries).forEach(([industry, count]) => {
        console.log(`  ${industry}: ${count} leads`);
      });

      console.log("Interest Levels:");
      Object.entries(interestLevels).forEach(([level, count]) => {
        console.log(`  ${level}: ${count} leads`);
      });
    }

    console.log("\n=== STORIES ANALYTICS ===");

    const allStories = await storiesService.findAll();
    if (allStories.length > 0) {
      // License distribution
      const licenses: Record<string, number> = {};
      const ownershipStats: Record<string, number> = {};
      let remixCount = 0;

      allStories.forEach((story) => {
        licenses[story.remix_license_terms] =
          (licenses[story.remix_license_terms] || 0) + 1;

        const ownerCount = story.owners.length;
        ownershipStats[ownerCount] = (ownershipStats[ownerCount] || 0) + 1;

        if (story.parent_ipa !== "ipa:root:original") {
          remixCount++;
        }
      });

      console.log("License Distribution:");
      Object.entries(licenses).forEach(([license, count]) => {
        console.log(`  ${license}: ${count} stories`);
      });

      console.log(
        `Original vs Remix: ${
          allStories.length - remixCount
        } original, ${remixCount} remixes`
      );

      const avgOwners =
        allStories.reduce((sum, story) => sum + story.owners.length, 0) /
        allStories.length;
      console.log(`Average Owners per Story: ${avgOwners.toFixed(1)}`);
    }

    console.log("\n=== SOCIAL MEDIA ANALYTICS ===");

    const allSocials = await socialsService.findAll();
    if (allSocials.length > 0) {
      let twitterAccounts = 0;
      let telegramBots = 0;
      let linkedinAccounts = 0;
      let totalTwitterActions = 0;
      let totalTelegramMessages = 0;

      allSocials.forEach((social) => {
        if (social.twitter) {
          twitterAccounts++;
          totalTwitterActions += social.twitter.actions.length;
        }
        if (social.telegram) {
          telegramBots++;
          totalTelegramMessages += social.telegram.messages.length;
        }
        if (social.linkedin) {
          linkedinAccounts++;
        }
      });

      console.log(
        `Twitter Accounts: ${twitterAccounts} (${totalTwitterActions} total actions)`
      );
      console.log(
        `Telegram Bots: ${telegramBots} (${totalTelegramMessages} total messages)`
      );
      console.log(`LinkedIn Accounts: ${linkedinAccounts}`);

      if (twitterAccounts > 0) {
        console.log(
          `Average Twitter Actions per Account: ${(
            totalTwitterActions / twitterAccounts
          ).toFixed(1)}`
        );
      }
      if (telegramBots > 0) {
        console.log(
          `Average Messages per Telegram Bot: ${(
            totalTelegramMessages / telegramBots
          ).toFixed(1)}`
        );
      }
    }

    console.log("\n=== GRANTS ANALYTICS ===");

    const allGrantCollections = await grantsService.findAll();
    if (allGrantCollections.length > 0) {
      let totalGrants = 0;
      let totalMilestones = 0;
      let totalMembers = 0;

      allGrantCollections.forEach((collection) => {
        totalGrants += collection.grants.length;
        totalMembers += collection.members.length;

        collection.grants.forEach((grant) => {
          totalMilestones += grant.milestones.length;
        });
      });

      console.log(`Total Grants: ${totalGrants}`);
      console.log(`Total Milestones: ${totalMilestones}`);
      console.log(
        `Average Grants per Collection: ${(
          totalGrants / allGrantCollections.length
        ).toFixed(1)}`
      );
      console.log(
        `Average Members per Collection: ${(
          totalMembers / allGrantCollections.length
        ).toFixed(1)}`
      );

      if (totalGrants > 0) {
        console.log(
          `Average Milestones per Grant: ${(
            totalMilestones / totalGrants
          ).toFixed(1)}`
        );
      }
    }

    console.log("\n=== COMPLIANCE ANALYTICS ===");

    const allCompliance = await complianceService.findAll();
    if (allCompliance.length > 0) {
      const regulations: Record<string, number> = {};
      const statuses: Record<string, number> = {};
      const riskLevels: Record<string, number> = {};

      allCompliance.forEach((record) => {
        const regulation = record.metadata.regulation;
        const status = record.metadata.status;
        const risk = record.metadata.riskLevel;

        if (regulation)
          regulations[regulation] = (regulations[regulation] || 0) + 1;
        if (status) statuses[status] = (statuses[status] || 0) + 1;
        if (risk) riskLevels[risk] = (riskLevels[risk] || 0) + 1;
      });

      console.log("Regulations:");
      Object.entries(regulations).forEach(([reg, count]) => {
        console.log(`  ${reg}: ${count} records`);
      });

      console.log("Compliance Status:");
      Object.entries(statuses).forEach(([status, count]) => {
        console.log(`  ${status}: ${count} records`);
      });

      console.log("Risk Levels:");
      Object.entries(riskLevels).forEach(([risk, count]) => {
        console.log(`  ${risk}: ${count} records`);
      });
    }

    console.log("\n✅ Analytics completed successfully!");
  } catch (error) {
    console.error("❌ Analytics failed:", error);
    process.exit(1);
  }
}

runAnalytics();
