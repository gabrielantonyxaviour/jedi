import { Address, zeroAddress } from "viem";
import { createHash } from "crypto";
import {
  IpMetadata,
  DisputeTargetTag,
  WIP_TOKEN_ADDRESS,
} from "@story-protocol/core-sdk";
import { createCommercialRemixTerms } from "../../utils/utils";

export interface ProjectIPMetadata {
  title: string;
  description: string;
  createdAt: string;
  developers: Array<{
    name: string;
    githubUsername: string;
    walletAddress: string;
    contributionPercent: number;
  }>;
  repositoryUrl: string;
  documentationUrl?: string;
  logoUrl?: string;
  logoHash?: string;
  demoUrl?: string;
  license: string;
  programmingLanguages: string[];
  framework?: string;
}

export interface ProjectNFTMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

export interface DerivativeProjectData {
  parentIpIds: Address[];
  licenseTermsIds: string[];
}

export interface ProjectDisputeData {
  targetIpId: Address;
  evidence: string;
  targetTag: DisputeTargetTag;
  bond: bigint;
  liveness: number;
}

export class StoryProtocolService {
  private client: any;
  private spgNftContract: Address;
  private nftContract: Address;
  private uploadJSONToIPFS: (data: any) => Promise<string>;
  private uploadTextToIPFS: (text: string) => Promise<string>;
  private mintNFT?: (
    address: Address,
    uri: string
  ) => Promise<number | undefined>;

  constructor(
    client: any,
    spgNftContract: Address,
    nftContract: Address,
    uploadJSONToIPFS: (data: any) => Promise<string>,
    uploadTextToIPFS: (text: string) => Promise<string>,
    mintNFT?: (address: Address, uri: string) => Promise<number | undefined>
  ) {
    this.client = client;
    this.spgNftContract = spgNftContract;
    this.nftContract = nftContract;
    this.uploadJSONToIPFS = uploadJSONToIPFS;
    this.uploadTextToIPFS = uploadTextToIPFS;
    this.mintNFT = mintNFT;
  }

  async createNewProject(
    projectMetadata: ProjectIPMetadata,
    nftMetadata: ProjectNFTMetadata,
    licenseTermsData: any[]
  ) {
    console.log(
      `📦 Registering GitHub project as IP: ${projectMetadata.title}`
    );
    console.log(`🔗 Repository: ${projectMetadata.repositoryUrl}`);

    // Convert project metadata to IP metadata format
    const ipMetadata: IpMetadata = this.client.ipAsset.generateIpMetadata({
      title: projectMetadata.title,
      description: projectMetadata.description,
      createdAt: projectMetadata.createdAt,
      creators: projectMetadata.developers.map((dev) => ({
        name: `${dev.name} (@${dev.githubUsername})`,
        address: dev.walletAddress,
        contributionPercent: dev.contributionPercent,
      })),
      image: projectMetadata.logoUrl || "",
      imageHash: projectMetadata.logoHash || "",
      mediaUrl: projectMetadata.repositoryUrl,
      mediaHash: createHash("sha256")
        .update(projectMetadata.repositoryUrl)
        .digest("hex"),
      mediaType: "application/git",
    });

    // Upload metadata to IPFS
    const ipIpfsHash = await this.uploadJSONToIPFS(ipMetadata);
    const ipHash = createHash("sha256")
      .update(JSON.stringify(ipMetadata))
      .digest("hex");

    const nftIpfsHash = await this.uploadJSONToIPFS(nftMetadata);
    const nftHash = createHash("sha256")
      .update(JSON.stringify(nftMetadata))
      .digest("hex");

    console.log(`📤 Project metadata uploaded to IPFS: ${ipIpfsHash}`);

    // Register the GitHub project as IP asset
    const response =
      await this.client.ipAsset.mintAndRegisterIpAssetWithPilTerms({
        spgNftContract: this.spgNftContract,
        licenseTermsData: [
          {
            terms: createCommercialRemixTerms({
              commercialRevShare: parseInt(licenseTermsData[0]),
              defaultMintingFee: parseInt(licenseTermsData[1]),
            }),
          },
        ],
        ipMetadata: {
          ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
          ipMetadataHash: `0x${ipHash}`,
          nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
          nftMetadataHash: `0x${nftHash}`,
        },
      });

    console.log(`✅ GitHub project registered as IP with ID: ${response.ipId}`);
    console.log(
      `🎫 License terms created: ${response.licenseTermsIds.join(", ")}`
    );

    return {
      txHash: response.txHash,
      ipId: response.ipId,
      licenseTermsIds: response.licenseTermsIds,
      ipMetadataHash: `0x${ipHash}`,
      nftMetadataHash: `0x${nftHash}`,
      repositoryUrl: projectMetadata.repositoryUrl,
    };
  }

  async createDerivativeProject(
    projectMetadata: ProjectIPMetadata,
    nftMetadata: ProjectNFTMetadata,
    parentProjectData: DerivativeProjectData
  ) {
    console.log(`🍴 Creating fork of parent project as commercial derivative`);
    console.log(`📦 Fork name: ${projectMetadata.title}`);
    console.log(`🔗 Fork repository: ${projectMetadata.repositoryUrl}`);

    const ipMetadata: IpMetadata = this.client.ipAsset.generateIpMetadata({
      title: projectMetadata.title,
      description: projectMetadata.description,
      createdAt: projectMetadata.createdAt,
      creators: projectMetadata.developers.map((dev) => ({
        name: `${dev.name} (@${dev.githubUsername})`,
        address: dev.walletAddress,
        contributionPercent: dev.contributionPercent,
      })),
      image: projectMetadata.logoUrl || "",
      imageHash: projectMetadata.logoHash || "",
      mediaUrl: projectMetadata.repositoryUrl,
      mediaHash: createHash("sha256")
        .update(projectMetadata.repositoryUrl)
        .digest("hex"),
      mediaType: "application/git",
    });

    const ipIpfsHash = await this.uploadJSONToIPFS(ipMetadata);
    const ipHash = createHash("sha256")
      .update(JSON.stringify(ipMetadata))
      .digest("hex");

    const nftIpfsHash = await this.uploadJSONToIPFS(nftMetadata);
    const nftHash = createHash("sha256")
      .update(JSON.stringify(nftMetadata))
      .digest("hex");

    console.log(`📤 Fork metadata uploaded to IPFS: ${ipIpfsHash}`);

    const response =
      await this.client.ipAsset.mintAndRegisterIpAndMakeDerivative({
        spgNftContract: this.spgNftContract,
        derivData: parentProjectData,
        ipMetadata: {
          ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
          ipMetadataHash: `0x${ipHash}`,
          nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
          nftMetadataHash: `0x${nftHash}`,
        },
      });

    console.log(
      `✅ Project fork registered as derivative IP: ${response.ipId}`
    );
    console.log(`💰 Parent projects will receive royalties from this fork`);

    return response;
  }

  async createProjectRemix(
    projectMetadata: ProjectIPMetadata,
    nftMetadata: ProjectNFTMetadata,
    parentProjectData: DerivativeProjectData,
    developerAddress: Address
  ) {
    console.log(`🎨 Creating project remix as custom derivative`);
    console.log(`📦 Remix project: ${projectMetadata.title}`);
    console.log(`👨‍💻 Developer: ${developerAddress}`);

    if (!this.mintNFT) {
      throw new Error("mintNFT function not provided for project remix");
    }

    const nftIpfsHash = await this.uploadJSONToIPFS(nftMetadata);
    console.log(`📤 Remix NFT metadata uploaded: ${nftIpfsHash}`);

    const projectTokenId = await this.mintNFT(
      developerAddress,
      `https://ipfs.io/ipfs/${nftIpfsHash}`
    );
    console.log(`🎫 Project NFT minted with token ID: ${projectTokenId}`);

    const ipMetadata: IpMetadata = this.client.ipAsset.generateIpMetadata({
      title: projectMetadata.title,
      description: projectMetadata.description,
      createdAt: projectMetadata.createdAt,
      creators: projectMetadata.developers.map((dev) => ({
        name: `${dev.name} (@${dev.githubUsername})`,
        address: dev.walletAddress,
        contributionPercent: dev.contributionPercent,
      })),
      image: projectMetadata.logoUrl || "",
      imageHash: projectMetadata.logoHash || "",
      mediaUrl: projectMetadata.repositoryUrl,
      mediaHash: createHash("sha256")
        .update(projectMetadata.repositoryUrl)
        .digest("hex"),
      mediaType: "application/git",
    });

    const ipIpfsHash = await this.uploadJSONToIPFS(ipMetadata);
    const ipHash = createHash("sha256")
      .update(JSON.stringify(ipMetadata))
      .digest("hex");
    const nftHash = createHash("sha256")
      .update(JSON.stringify(nftMetadata))
      .digest("hex");

    const response = await this.client.ipAsset.registerDerivativeIp({
      nftContract: this.nftContract,
      tokenId: projectTokenId,
      derivData: parentProjectData,
      ipMetadata: {
        ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
        ipMetadataHash: `0x${ipHash}`,
        nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
        nftMetadataHash: `0x${nftHash}`,
      },
    });

    console.log(
      `✅ Project remix registered as derivative IP: ${response.ipId}`
    );
    return response;
  }

  async createOpenSourceProject(
    projectMetadata: ProjectIPMetadata,
    nftMetadata: ProjectNFTMetadata,
    parentProjectId: Address,
    nonCommercialTermsId: string
  ) {
    console.log(`🆓 Registering open-source project derivative`);
    console.log(`📦 Project: ${projectMetadata.title}`);
    console.log(`📜 License: Non-commercial open source`);

    const ipMetadata: IpMetadata = this.client.ipAsset.generateIpMetadata({
      title: projectMetadata.title,
      description: projectMetadata.description,
      createdAt: projectMetadata.createdAt,
      creators: projectMetadata.developers.map((dev) => ({
        name: `${dev.name} (@${dev.githubUsername})`,
        address: dev.walletAddress,
        contributionPercent: dev.contributionPercent,
      })),
      image: projectMetadata.logoUrl || "",
      imageHash: projectMetadata.logoHash || "",
      mediaUrl: projectMetadata.repositoryUrl,
      mediaHash: createHash("sha256")
        .update(projectMetadata.repositoryUrl)
        .digest("hex"),
      mediaType: "application/git",
    });

    const ipIpfsHash = await this.uploadJSONToIPFS(ipMetadata);
    const ipHash = createHash("sha256")
      .update(JSON.stringify(ipMetadata))
      .digest("hex");

    const nftIpfsHash = await this.uploadJSONToIPFS(nftMetadata);
    const nftHash = createHash("sha256")
      .update(JSON.stringify(nftMetadata))
      .digest("hex");

    const response =
      await this.client.ipAsset.mintAndRegisterIpAndMakeDerivative({
        spgNftContract: this.spgNftContract,
        derivData: {
          parentIpIds: [parentProjectId],
          licenseTermsIds: [nonCommercialTermsId],
        },
        ipMetadata: {
          ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
          ipMetadataHash: `0x${ipHash}`,
          nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
          nftMetadataHash: `0x${nftHash}`,
        },
      });

    console.log(`✅ Open-source project registered as IP: ${response.ipId}`);
    console.log(`🔓 Free for non-commercial use and contributions`);
    return response;
  }

  async disputeProjectIP(disputeData: ProjectDisputeData) {
    console.log(
      `⚖️ Filing dispute against project IP: ${disputeData.targetIpId}`
    );
    console.log(`📋 Dispute reason: Code plagiarism/IP violation`);

    const evidenceHash = await this.uploadTextToIPFS(disputeData.evidence);
    console.log(`📤 Dispute evidence uploaded to IPFS: ${evidenceHash}`);

    const response = await this.client.dispute.raiseDispute({
      targetIpId: disputeData.targetIpId,
      cid: evidenceHash,
      targetTag: disputeData.targetTag,
      bond: disputeData.bond,
      liveness: disputeData.liveness,
    });

    console.log(`✅ Project IP dispute filed with ID: ${response.disputeId}`);
    console.log(`💰 Dispute bond posted: ${disputeData.bond} WEI`);
    return response;
  }

  async claimDeveloperRoyalties(
    projectIpId: Address,
    royaltyPolicies: Address[] = [],
    currencyTokens: Address[] = [WIP_TOKEN_ADDRESS]
  ) {
    console.log(`💰 Claiming developer royalties for project: ${projectIpId}`);
    console.log(`🍴 From all derivative projects`);

    const response = await this.client.royalty.claimAllRevenue({
      ancestorIpId: projectIpId,
      claimer: projectIpId,
      childIpIds: [],
      royaltyPolicies,
      currencyTokens,
    });

    console.log(`✅ Developer royalties claimed: ${response.claimedTokens}`);
    console.log(`💵 Tokens received from project licensing and forks`);
    return response;
  }

  async payProjectLicenseFee(
    projectIpId: Address,
    amount: bigint,
    payerAddress: Address = zeroAddress,
    token: Address = WIP_TOKEN_ADDRESS
  ) {
    console.log(`💸 Paying license fee for project: ${projectIpId}`);
    console.log(`💰 Amount: ${amount} tokens`);
    console.log(`👨‍💻 Payer: ${payerAddress}`);

    const response = await this.client.royalty.payRoyaltyOnBehalf({
      receiverIpId: projectIpId,
      payerIpId: payerAddress,
      token,
      amount,
    });

    console.log(`✅ License fee paid: ${response.txHash}`);
    console.log(`🎫 Project usage rights acquired`);
    return response;
  }

  async claimParentProjectRoyalties(
    parentProjectId: Address,
    forkProjectIds: Address[],
    royaltyPolicies: Address[],
    currencyTokens: Address[] = [WIP_TOKEN_ADDRESS]
  ) {
    console.log(`💰 Claiming royalties for parent project: ${parentProjectId}`);
    console.log(`🍴 From ${forkProjectIds.length} project forks`);

    const response = await this.client.royalty.claimAllRevenue({
      ancestorIpId: parentProjectId,
      claimer: parentProjectId,
      childIpIds: forkProjectIds,
      royaltyPolicies,
      currencyTokens,
    });

    console.log(
      `✅ Parent project royalties claimed: ${response.claimedTokens}`
    );
    console.log(`📈 Revenue generated from project derivatives and forks`);
    return response;
  }

  async getProjectIPDetails(projectIpId: Address) {
    console.log(`🔍 Fetching project IP details: ${projectIpId}`);

    try {
      const projectAsset = await this.client.ipAsset.getIpAssetDetails(
        projectIpId
      );
      console.log(`✅ Project IP details retrieved successfully`);
      console.log(`📦 Project registered and protected on Story Protocol`);
      return projectAsset;
    } catch (error) {
      console.error(`❌ Failed to fetch project IP details: ${error}`);
      throw error;
    }
  }

  async getProjectLicenseTerms(licenseTermsId: string) {
    console.log(`📄 Fetching license terms for project: ${licenseTermsId}`);

    try {
      const terms = await this.client.license.getLicenseTerms(licenseTermsId);
      console.log(`✅ Project license terms retrieved successfully`);
      console.log(`📜 Developer rights and usage terms loaded`);
      return terms;
    } catch (error) {
      console.error(`❌ Failed to fetch project license terms: ${error}`);
      throw error;
    }
  }
}
