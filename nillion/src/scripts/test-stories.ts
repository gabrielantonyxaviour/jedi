import dotenv from "dotenv";
dotenv.config();

import { ServiceFactory } from "../services/index.js";

async function testStories() {
  console.log("🧪 Testing Stories Service...\n");

  const storiesService = ServiceFactory.getStories();

  try {
    // Create test stories
    console.log("📝 Creating test stories...");

    const storyId1 = await storiesService.createStory(
      "The AI Revolution Chronicles",
      "A comprehensive narrative about the impact of AI on modern society",
      ["author_alice", "editor_bob"],
      "https://images.unsplash.com/ai-revolution",
      "ipa:story:ai-revolution:001",
      "ipa:root:original",
      "commercial",
      "0x1234567890abcdef1234567890abcdef12345678"
    );

    const storyId2 = await storiesService.createStory(
      "Blockchain Democracy",
      "Exploring decentralized governance through blockchain technology",
      ["crypto_charlie", "analyst_diana"],
      "https://images.unsplash.com/blockchain-vote",
      "ipa:story:blockchain-democracy:001",
      "ipa:root:original",
      "non-commercial",
      "0xabcdef1234567890abcdef1234567890abcdef12"
    );

    const storyId3 = await storiesService.createStory(
      "AI Revolution - Chapter 2",
      "Extended narrative building on the original AI Revolution story",
      ["remix_author_eve"],
      "https://images.unsplash.com/ai-revolution-2",
      "ipa:story:ai-revolution:002",
      "ipa:story:ai-revolution:001",
      "commercial",
      "0x567890abcdef1234567890abcdef1234567890ab"
    );

    console.log(`✅ Created stories: ${storyId1}, ${storyId2}, ${storyId3}\n`);

    // Read stories
    console.log("📖 Reading stories...");
    const allStories = await storiesService.findAll();
    console.log(`📊 Total stories: ${allStories.length}`);

    const aliceStories = await storiesService.getStoriesByOwner("author_alice");
    console.log(`✍️ Alice's stories: ${aliceStories.length}`);

    const commercialStories = await storiesService.getStoriesByLicense(
      "commercial"
    );
    console.log(`💰 Commercial stories: ${commercialStories.length}`);

    const remixStories = await storiesService.getStoriesByParentIpa(
      "ipa:story:ai-revolution:001"
    );
    console.log(`🔄 Remixed stories: ${remixStories.length}`);

    // Display sample story
    if (allStories.length > 0) {
      console.log("\n📄 Sample story:");
      const story = allStories[0];
      console.log(`  Name: ${story.name}`);
      console.log(`  Owners: ${story.owners.join(", ")}`);
      console.log(`  IPA: ${story.ipa}`);
      console.log(`  Parent IPA: ${story.parent_ipa}`);
      console.log(`  License: ${story.remix_license_terms}`);
      console.log(`  TX Hash: ${story.register_tx_hash}`);
    }

    console.log("\n✅ Stories service test completed successfully!");
  } catch (error) {
    console.error("❌ Stories service test failed:", error);
    process.exit(1);
  }
}

testStories();
