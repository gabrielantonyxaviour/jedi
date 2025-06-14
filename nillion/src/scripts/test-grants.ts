import dotenv from "dotenv";
dotenv.config();

import { ServiceFactory } from "../services";

async function testGrants() {
  console.log("🧪 Testing Grants Service...\n");

  const grantsService = ServiceFactory.getGrants();

  try {
    // Create test grant collections
    console.log("📝 Creating test grant collections...");

    const collectionId1 = await grantsService.createGrantCollection(
      "AI Research Initiative",
      "Comprehensive research program focused on advancing AI safety and ethics",
      ["https://airesearch.org", "https://github.com/airesearch/projects"],
      "https://images.unsplash.com/ai-research",
      "dr_sarah_ai",
      ["researcher_john", "analyst_mary", "dev_alex"],
      "sarah.ai@university.edu",
      "Dr. Sarah Anderson"
    );

    const collectionId2 = await grantsService.createGrantCollection(
      "Blockchain Infrastructure",
      "Building next-generation blockchain infrastructure for Web3",
      ["https://blockchaininfra.io", "https://docs.blockchaininfra.io"],
      "https://images.unsplash.com/blockchain-nodes",
      "crypto_mike",
      ["blockchain_dev", "security_expert"],
      "mike@blockchaininfra.io",
      "Mike Chen"
    );

    console.log(
      `✅ Created grant collections: ${collectionId1}, ${collectionId2}\n`
    );

    // Add grants to collections
    console.log("💰 Adding grants...");
    await grantsService.addGrant(
      collectionId1,
      "NSF AI Safety Grant",
      "Research grant focused on developing AI safety protocols and frameworks",
      [
        {
          id: "milestone_001",
          name: "Literature Review",
          desc: "Comprehensive review of existing AI safety research",
          created_at: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        },
        {
          id: "milestone_002",
          name: "Framework Development",
          desc: "Design and develop AI safety evaluation framework",
          created_at: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
        },
      ]
    );

    await grantsService.addGrant(
      collectionId1,
      "OpenAI Research Partnership",
      "Collaborative research on AI alignment and interpretability"
    );

    await grantsService.addGrant(
      collectionId2,
      "Ethereum Foundation Grant",
      "Infrastructure improvements for Ethereum Layer 2 solutions"
    );

    // Add additional milestones
    console.log("🎯 Adding milestones...");
    const collection1 = await grantsService.findById(collectionId1);
    if (collection1 && collection1.grants.length > 1) {
      await grantsService.addMilestone(
        collectionId1,
        collection1.grants[1].id,
        "Initial Research Phase",
        "Complete preliminary research and establish research methodology"
      );
    }

    // Read grant collections
    console.log("\n📖 Reading grant collections...");
    const allCollections = await grantsService.findAll();
    console.log(`📊 Total grant collections: ${allCollections.length}`);

    const sarahCollections = await grantsService.getGrantsByOwner(
      "dr_sarah_ai"
    );
    console.log(`👤 Sarah's collections: ${sarahCollections.length}`);

    const johnCollections = await grantsService.getGrantsByMember(
      "researcher_john"
    );
    console.log(`🤝 John's collaborations: ${johnCollections.length}`);

    // Display sample collection
    if (allCollections.length > 0) {
      console.log("\n📄 Sample grant collection:");
      const collection = allCollections[0];
      console.log(`  Name: ${collection.name}`);
      console.log(`  Owner: ${collection.owner}`);
      console.log(`  Members: ${collection.members.join(", ")}`);
      console.log(`  Total Grants: ${collection.grants.length}`);

      if (collection.grants.length > 0) {
        const grant = collection.grants[0];
        console.log(`  Sample Grant: ${grant.name}`);
        console.log(`  Milestones: ${grant.milestones.length}`);

        if (grant.milestones.length > 0) {
          const milestone = grant.milestones[0];
          console.log(`    Latest Milestone: ${milestone.name}`);
        }
      }
    }

    console.log("\n✅ Grants service test completed successfully!");
  } catch (error) {
    console.error("❌ Grants service test failed:", error);
    process.exit(1);
  }
}

testGrants();
