import { aeneid, mainnet, StoryClient } from "@story-protocol/core-sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";

dotenv.config();

// Network configurations
const networkConfigs = {
  aeneid: {
    rpcProviderUrl: "https://aeneid.storyrpc.io",
    blockExplorer: "https://aeneid.storyscan.io",
    protocolExplorer: "https://aeneid.explorer.story.foundation",
    defaultNFTContractAddress: "0x937bef10ba6fb941ed84b8d249abc76031429a9a",
    defaultSPGNFTContractAddress: "0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc",
    chain: aeneid,
  },
  mainnet: {
    rpcProviderUrl: "https://mainnet.storyrpc.io",
    blockExplorer: "https://storyscan.io",
    protocolExplorer: "https://explorer.story.foundation",
    defaultNFTContractAddress: null,
    defaultSPGNFTContractAddress: "0x98971c660ac20880b60F86Cc3113eBd979eb3aAE",
    chain: mainnet,
  },
};

const getNetwork = () => {
  const network = process.env.STORY_NETWORK;
  if (network && !(network in networkConfigs)) {
    throw new Error(
      `Invalid network: ${network}. Must be one of: ${Object.keys(
        networkConfigs
      ).join(", ")}`
    );
  }
  return network || "aeneid";
};

// Initialize client configuration
export const network = getNetwork();

export const networkInfo = {
  ...networkConfigs[network],
  rpcProviderUrl:
    process.env.RPC_PROVIDER_URL || networkConfigs[network].rpcProviderUrl,
};

export const account = privateKeyToAccount(
  `0x${process.env.WALLET_PRIVATE_KEY}`
);

const config = {
  account,
  transport: http(networkInfo.rpcProviderUrl),
  chainId: network,
};

export const client = StoryClient.newClient(config);

const baseConfig = {
  chain: networkInfo.chain,
  transport: http(networkInfo.rpcProviderUrl),
};
export const publicClient = createPublicClient(baseConfig);
export const walletClient = createWalletClient({
  ...baseConfig,
  account,
});
