// src/index.ts
import "dotenv/config";
import { KarmaService } from "./services/karma";
import { Address, Hex } from "viem";

async function main() {
  const karma = new KarmaService();

  console.log(`🔑 Using wallet: ${karma.getWalletAddress()}\n`);

  try {
    // 1. Fetch existing projects
    console.log("=== FETCHING PROJECTS ===");
    const projects = await karma.fetchProjects();
    projects.slice(0, 3).forEach((p) => {
      console.log(`- ${p.details?.title || "Untitled"} (${p.uid})`);
    });

    // 2. Fetch communities
    console.log("\n=== FETCHING COMMUNITIES ===");
    const communities = await karma.fetchCommunities();
    communities.slice(0, 5).forEach((c) => {
      console.log(`- ${c.details?.name || "Unnamed"} (${c.uid})`);
    });

    // 3. Create a test project
    console.log("\n=== CREATING TEST PROJECT ===");
    const testProject = await karma.createProject({
      title: "Test DeFi Protocol",
      description:
        "A test project for DeFi protocol development using Karma SDK",
      imageURL: "https://example.com/image.png",
      links: [
        { type: "github", url: "https://github.com/test/project" },
        { type: "website", url: "https://testproject.com" },
      ],
      tags: [{ name: "DeFi" }, { name: "Protocol" }, { name: "Test" }],
      ownerAddress: karma.getWalletAddress() as Address,
    });

    const projectUID = testProject.uid as Hex;
    console.log(`Project UID: ${projectUID}`);

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 4. Apply for a grant (if communities exist)

    if (communities.length > 0) {
      console.log("\n=== APPLYING FOR GRANT ===");
      const grantApplication = await karma.applyForGrant(
        {
          title: "DeFi Protocol Development Grant",
          description: "Funding request for developing our DeFi protocol",
          proposalURL: "https://testproject.com/proposal",
          communityUID: communities[0].uid,
          cycle: "Q1",
          season: "2024",
        },
        projectUID
      );

      const grantUID = grantApplication.uids[0] as Hex;
      console.log(`Grant UID: ${grantUID}`);

      // 5. Create a milestone
      console.log("\n=== CREATING MILESTONE ===");
      const milestone = await karma.createMilestone({
        title: "Smart Contract Development",
        description: "Complete the core smart contracts for the protocol",
        endsAt: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
        grantUID: grantUID,
        projectUID: projectUID,
      });

      const milestoneUID = milestone.uids[0] as Hex;
      console.log(`Milestone UID: ${milestoneUID}`);

      // 6. Update the milestone
      console.log("\n=== UPDATING MILESTONE ===");
      await karma.updateMilestone(projectUID, grantUID, milestoneUID, {
        title: "Smart Contract Development - Updated",
        description:
          "Complete the core smart contracts for the protocol with additional security features",
        endsAt: Math.floor(Date.now() / 1000) + 45 * 24 * 60 * 60, // 45 days from now
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 7. Fetch project details
    console.log("\n=== FETCHING PROJECT DETAILS ===");
    const projectDetails = await karma.fetchProjectById(projectUID);
    console.log(`Project: ${projectDetails.details?.title}`);
    console.log(`Grants: ${projectDetails.grants.length}`);
    projectDetails.grants.forEach((grant) => {
      console.log(
        `  - Grant: ${grant.details?.title} (${grant.milestones.length} milestones)`
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 8. Fetch grant opportunities
    console.log("\n=== FETCHING GRANT OPPORTUNITIES ===");
    const opportunities = await karma.fetchGrantOpportunities();
    opportunities.slice(0, 5).forEach((opp: any) => {
      console.log(`- ${opp.grantTitle} by ${opp.communityName}`);
    });

    console.log("\n✅ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main().catch(console.error);
