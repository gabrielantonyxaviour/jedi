import "dotenv/config";
import {
  StoryProtocolService,
  ProjectIPMetadata,
  ProjectNFTMetadata,
} from "./services/story";
import { Address, parseEther } from "viem";
import { DisputeTargetTag } from "@story-protocol/core-sdk";
import { client, networkInfo } from "./utils/config";
import { mintNFT } from "./utils/mint-nft";
import { uploadJSONToIPFS, uploadTextToIPFS } from "./utils/pinata";
import { createCommercialRemixTerms } from "./utils/utils";

async function testStoryProtocolService() {
  const spgNftContract = networkInfo.defaultSPGNFTContractAddress;
  const nftContract = networkInfo.defaultNFTContractAddress;

  const storyService = new StoryProtocolService(
    client,
    spgNftContract as Address,
    nftContract as Address,
    uploadJSONToIPFS,
    uploadTextToIPFS,
    mintNFT
  );

  // Project metadata
  const projectMetadata: ProjectIPMetadata = {
    title: "DecentralizedChat",
    description: "A decentralized chat application built with React and Web3",
    createdAt: Math.floor(Date.now() / 1000).toString(),
    developers: [
      {
        name: "Alice Smith",
        githubUsername: "alice-dev",
        walletAddress: "0x...",
        contributionPercent: 60,
      },
      {
        name: "Bob Johnson",
        githubUsername: "bob-codes",
        walletAddress: "0x...",
        contributionPercent: 40,
      },
    ],
    repositoryUrl: "https://github.com/alice-dev/decentralized-chat",
    documentationUrl: "https://docs.decentralizedchat.com",
    logoUrl: "https://github.com/alice-dev/decentralized-chat/logo.png",
    demoUrl: "https://demo.decentralizedchat.com",
    license: "MIT",
    programmingLanguages: ["TypeScript", "Solidity"],
    framework: "React",
  };

  const nftMetadata: ProjectNFTMetadata = {
    name: "DecentralizedChat IP Certificate",
    description:
      "IP certificate for DecentralizedChat - A decentralized messaging platform",
    image: "https://github.com/alice-dev/decentralized-chat/logo.png",
    external_url: "https://github.com/alice-dev/decentralized-chat",
    attributes: [
      { trait_type: "Project Type", value: "DApp" },
      { trait_type: "Primary Language", value: "TypeScript" },
      { trait_type: "Framework", value: "React" },
      { trait_type: "License", value: "MIT" },
      { trait_type: "Contributors", value: "2" },
    ],
  };

  try {
    // 1. Register GitHub project as IP
    console.log("\n=== REGISTERING GITHUB PROJECT ===");
    const project = await storyService.createNewProject(
      projectMetadata,
      nftMetadata,
      [
        {
          terms: createCommercialRemixTerms({
            defaultMintingFee: 1,
            commercialRevShare: 5,
          }),
        },
      ] // License terms
    );
    console.log("🎉 Project registered:", project);

    // 2. Create project fork
    console.log("\n=== CREATING PROJECT FORK ===");
    const fork = await storyService.createDerivativeProject(
      {
        ...projectMetadata,
        title: "DecentralizedChat-Mobile",
        description: "Mobile version of DecentralizedChat",
        repositoryUrl: "https://github.com/bob-codes/decentralized-chat-mobile",
        developers: [
          {
            name: "Bob Johnson",
            githubUsername: "bob-codes",
            walletAddress: "0x...",
            contributionPercent: 100,
          },
        ],
      },
      {
        ...nftMetadata,
        name: "DecentralizedChat Mobile Fork",
      },
      {
        parentIpIds: [project.ipId as Address],
        licenseTermsIds: project.licenseTermsIds,
      }
    );
    console.log("🍴 Fork created:", fork);

    // 3. Pay license fee
    console.log("\n=== PAYING PROJECT LICENSE FEE ===");
    const licensePayment = await storyService.payProjectLicenseFee(
      fork.ipId as Address,
      parseEther("0.5")
    );
    console.log("💳 License fee paid:", licensePayment);

    // 4. Claim developer royalties
    console.log("\n=== CLAIMING DEVELOPER ROYALTIES ===");
    const royalties = await storyService.claimDeveloperRoyalties(
      project.ipId as Address
    );
    console.log("💰 Royalties claimed:", royalties);

    // 5. Dispute project IP
    console.log("\n=== DISPUTING PROJECT IP ===");
    const dispute = await storyService.disputeProjectIP({
      targetIpId: fork.ipId as Address,
      evidence:
        "This project contains plagiarized code from our proprietary repository without permission",
      targetTag: DisputeTargetTag.IMPROPER_REGISTRATION,
      bond: parseEther("0.1"),
      liveness: 2592000,
    });
    console.log("⚖️ Dispute filed:", dispute);

    // 6. Get project details
    console.log("\n=== FETCHING PROJECT DETAILS ===");
    const projectDetails = await storyService.getProjectIPDetails(
      project.ipId as Address
    );
    console.log("📋 Project details:", projectDetails);

    console.log("\n✅ All GitHub project IP protection tests completed!");
    console.log("🎉 Your code is now protected on Story Protocol blockchain!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testStoryProtocolService().catch(console.error);
