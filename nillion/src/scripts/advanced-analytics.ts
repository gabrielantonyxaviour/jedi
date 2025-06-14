import dotenv from "dotenv";
dotenv.config();

import { ServiceFactory } from "../services";
import { QueryBuilder } from "../utils/query-builder";

async function advancedAnalytics() {
  console.log("📊 Running Advanced Multi-Agent Analytics...\n");

  try {
    const services = {
      logs: ServiceFactory.getLogs(),
      github: ServiceFactory.getGithub(),
      leads: ServiceFactory.getLeads(),
      stories: ServiceFactory.getStories(),
      socials: ServiceFactory.getSocials(),
      grants: ServiceFactory.getGrants(),
      compliance: ServiceFactory.getCompliance(),
    };

    console.log("=== CROSS-AGENT CORRELATION ANALYSIS ===\n");

    // Get all data for cross-analysis
    const [logs, projects, leads, stories, socials, grants, compliance] =
      await Promise.all([
        services.logs.findAll(),
        services.github.findAll(),
        services.leads.findAll(),
        services.stories.findAll(),
        services.socials.findAll(),
        services.grants.findAll(),
        services.compliance.findAll(),
      ]);

    // Agent activity correlation with project success
    console.log("🔗 Agent Activity vs Project Metrics:");

    const projectStats = projects.map((project) => {
      const projectLogs = logs.filter(
        (log) => log.data.repoUrl === project.repo_url
      );
      const agentActivity = projectLogs.reduce((acc, log) => {
        acc[log.agentName] = (acc[log.agentName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        name: project.name,
        stars: project.metadata.stars || 0,
        collaborators: project.collab.length,
        agentActivity,
        totalActivity: Object.values(agentActivity).reduce(
          (sum, count) => sum + count,
          0
        ),
      };
    });

    projectStats.forEach((project) => {
      const activityScore = project.totalActivity;
      const successScore = project.stars + project.collaborators * 10;
      console.log(
        `  ${project.name}: Activity=${activityScore}, Success=${successScore}`
      );
    });

    // Lead conversion analysis
    console.log("\n💰 Lead Source Effectiveness:");

    const leadSourceAnalysis = leads.reduce((acc, lead) => {
      const source = lead.source;
      const interestLevel = lead.metadata.interest_level;
      const budgetRange = lead.metadata.budget_range;

      if (!acc[source]) {
        acc[source] = { count: 0, highInterest: 0, totalBudget: 0 };
      }

      acc[source].count++;
      if (interestLevel === "high") acc[source].highInterest++;

      // Extract budget numbers (simplified)
      const budgetMatch = budgetRange?.match(/\$(\d+)k/);
      if (budgetMatch) {
        acc[source].totalBudget += parseInt(budgetMatch[1]) * 1000;
      }

      return acc;
    }, {} as Record<string, any>);

    Object.entries(leadSourceAnalysis).forEach(([source, stats]) => {
      const conversionRate = ((stats.highInterest / stats.count) * 100).toFixed(
        1
      );
      const avgBudget = (stats.totalBudget / stats.count).toFixed(0);
      console.log(
        `  ${source}: ${stats.count} leads, ${conversionRate}% high interest, $${avgBudget} avg budget`
      );
    });

    // Social media engagement patterns
    console.log("\n📱 Social Media Engagement Patterns:");

    const socialAnalysis = socials.reduce((acc, social) => {
      if (social.twitter) {
        const actions = social.twitter.actions;
        const actionTypes = actions.reduce((typeCount, action) => {
          typeCount[action.action] = (typeCount[action.action] || 0) + 1;
          return typeCount;
        }, {} as Record<string, number>);

        acc.twitter = acc.twitter || {
          accounts: 0,
          totalActions: 0,
          actionBreakdown: {},
        };
        acc.twitter.accounts++;
        acc.twitter.totalActions += actions.length;

        Object.entries(actionTypes).forEach(([type, count]) => {
          acc.twitter.actionBreakdown[type] =
            (acc.twitter.actionBreakdown[type] || 0) + count;
        });
      }

      if (social.telegram) {
        const messages = social.telegram.messages;
        acc.telegram = acc.telegram || { bots: 0, totalMessages: 0 };
        acc.telegram.bots++;
        acc.telegram.totalMessages += messages.length;
      }

      return acc;
    }, {} as any);

    if (socialAnalysis.twitter) {
      console.log(
        `  Twitter: ${socialAnalysis.twitter.accounts} accounts, ${socialAnalysis.twitter.totalActions} total actions`
      );
      Object.entries(socialAnalysis.twitter.actionBreakdown).forEach(
        ([action, count]) => {
          console.log(`    ${action}: ${count}`);
        }
      );
    }

    if (socialAnalysis.telegram) {
      console.log(
        `  Telegram: ${socialAnalysis.telegram.bots} bots, ${socialAnalysis.telegram.totalMessages} messages`
      );
      console.log(
        `    Avg messages per bot: ${(
          socialAnalysis.telegram.totalMessages / socialAnalysis.telegram.bots
        ).toFixed(1)}`
      );
    }

    // Grant success indicators
    console.log("\n🎯 Grant Performance Metrics:");

    const grantAnalysis = grants.reduce(
      (acc, grantCollection) => {
        acc.totalCollections++;
        acc.totalGrants += grantCollection.grants.length;
        acc.totalMembers += grantCollection.members.length;

        grantCollection.grants.forEach((grant) => {
          acc.totalMilestones += grant.milestones.length;

          const daysSinceApplication =
            (Date.now() - grant.applied_at) / (1000 * 60 * 60 * 24);
          const milestonesPerDay =
            grant.milestones.length / Math.max(daysSinceApplication, 1);
          acc.productivityScores.push(milestonesPerDay);
        });

        return acc;
      },
      {
        totalCollections: 0,
        totalGrants: 0,
        totalMembers: 0,
        totalMilestones: 0,
        productivityScores: [] as number[],
      }
    );

    if (grantAnalysis.totalGrants > 0) {
      const avgMilestonesPerGrant = (
        grantAnalysis.totalMilestones / grantAnalysis.totalGrants
      ).toFixed(1);
      const avgProductivity =
        grantAnalysis.productivityScores.reduce(
          (sum, score) => sum + score,
          0
        ) / grantAnalysis.productivityScores.length;

      console.log(`  Total Collections: ${grantAnalysis.totalCollections}`);
      console.log(`  Total Grants: ${grantAnalysis.totalGrants}`);
      console.log(`  Avg Milestones per Grant: ${avgMilestonesPerGrant}`);
      console.log(
        `  Avg Milestone Completion Rate: ${avgProductivity.toFixed(
          4
        )} milestones/day`
      );
    }

    // Compliance risk assessment
    console.log("\n⚖️ Compliance Risk Assessment:");

    const complianceRisk = compliance.reduce((acc, record) => {
      const regulation = record.metadata.regulation;
      const status = record.metadata.status;
      const riskLevel = record.metadata.riskLevel;

      acc[regulation] = acc[regulation] || {
        total: 0,
        compliant: 0,
        riskLevels: {},
      };
      acc[regulation].total++;

      if (status === "compliant") acc[regulation].compliant++;

      acc[regulation].riskLevels[riskLevel] =
        (acc[regulation].riskLevels[riskLevel] || 0) + 1;

      return acc;
    }, {} as Record<string, any>);

    Object.entries(complianceRisk).forEach(([regulation, data]) => {
      const complianceRate = ((data.compliant / data.total) * 100).toFixed(1);
      console.log(
        `  ${regulation}: ${complianceRate}% compliant (${data.total} records)`
      );

      Object.entries(data.riskLevels).forEach(([risk, count]) => {
        console.log(`    ${risk} risk: ${count}`);
      });
    });

    console.log("\n=== PREDICTIVE INSIGHTS ===\n");

    // Predict agent workload
    const agentWorkload = logs.reduce((acc, log) => {
      const hour = new Date(log._created || Date.now()).getHours();
      acc[log.agentName] = acc[log.agentName] || {};
      acc[log.agentName][hour] = (acc[log.agentName][hour] || 0) + 1;
      return acc;
    }, {} as Record<string, Record<number, number>>);

    console.log("🕐 Peak Activity Hours by Agent:");
    Object.entries(agentWorkload).forEach(([agent, hours]) => {
      const peakHour = Object.entries(hours).reduce(
        (peak, [hour, count]) =>
          count > (hours[peak] || 0) ? parseInt(hour) : peak,
        0
      );
      console.log(
        `  ${agent}: Peak at ${peakHour}:00 (${hours[peakHour]} actions)`
      );
    });

    // Project success prediction
    if (projectStats.length > 0) {
      console.log("\n🚀 Project Success Indicators:");

      const successMetrics = projectStats
        .map((project) => ({
          name: project.name,
          score:
            project.stars * 0.3 +
            project.collaborators * 0.4 +
            project.totalActivity * 0.3,
        }))
        .sort((a, b) => b.score - a.score);

      successMetrics.slice(0, 3).forEach((project, i) => {
        console.log(
          `  ${i + 1}. ${project.name}: Success Score ${project.score.toFixed(
            1
          )}`
        );
      });
    }

    console.log("\n✅ Advanced analytics completed successfully!");
  } catch (error) {
    console.error("❌ Advanced analytics failed:", error);
    process.exit(1);
  }
}

advancedAnalytics();
