import { createCommercialRemixTerms, SPGNFTContractAddress } from "./utils";
import { uploadJSONToIPFS } from "./functions/uploadToIPFS";
import { storyEVM, storyPublicClient } from "../ethereum";
import { createHash } from "crypto";
import { StoryClient } from "@story-protocol/core-sdk";
import { signWithAgent } from "@neardefi/shade-agent-js";
import { http } from "viem";
import { networkInfo, publicClient } from "./config";
import { storyAeneid } from "viem/chains";
import { utils } from "chainsig.js";
const { toRSV } = utils.cryptography;

export async function registerIp({
  title,
  description,
  imageURL,
  remixFee,
  commercialRevShare,
  creators,
  attributes,
}) {
  const contractId = process.env.NEXT_PUBLIC_contractId;
  // creators
  // {
  //   name: string;
  //   address: string;
  //   contributionPercent: number;
  // }
  // attributes
  // {
  //   key: string;
  //   value: string;
  // }
  const { address: senderAddress } = await storyEVM.deriveAddressAndPublicKey(
    contractId,
    "ethereum-1"
  );

  const config = {
    account: senderAddress,
    transport: http(networkInfo.rpcProviderUrl),
    chainId: storyAeneid.id,
  };

  const client = StoryClient.newClient(config);

  // 1. Set up your IP Metadata
  const ipMetadata = client.ipAsset.generateIpMetadata({
    title,
    description,
    createdAt: Math.floor(Date.now() / 1000).toString(),
    creators,
    image: imageURL,
    imageHash: createHash("sha256").update(imageURL).digest("hex"),
    mediaUrl: imageURL,
    mediaHash: createHash("sha256").update(imageURL).digest("hex"),
    mediaType: "audio/mpeg",
  });

  // 2. Set up your NFT Metadata
  const nftMetadata = {
    name: title,
    description,
    image: imageURL,
    animation_url: imageURL,
    attributes: attributes,
  };

  // 3. Upload your IP and NFT Metadata to IPFS
  const ipIpfsHash = await uploadJSONToIPFS(ipMetadata);
  const ipHash = createHash("sha256")
    .update(JSON.stringify(ipMetadata))
    .digest("hex");
  const nftIpfsHash = await uploadJSONToIPFS(nftMetadata);
  const nftHash = createHash("sha256")
    .update(JSON.stringify(nftMetadata))
    .digest("hex");

  // 4. Register the NFT as an IP Asset
  const response = await client.ipAsset.mintAndRegisterIpAssetWithPilTerms({
    spgNftContract: SPGNFTContractAddress,
    licenseTermsData: [
      {
        terms: createCommercialRemixTerms({
          defaultMintingFee: remixFee,
          commercialRevShare,
        }),
      },
    ],
    ipMetadata: {
      ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
      ipMetadataHash: `0x${ipHash}`,
      nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
      nftMetadataHash: `0x${nftHash}`,
    },
    txOptions: {
      encodedTxDataOnly: true,
    },
  });

  const { transaction, hashesToSign } =
    await storyEVM.prepareTransactionForSigning({
      from: senderAddress,
      to: response.encodedTxData.to,
      data: response.encodedTxData.data,
    });

  let signRes;
  let verified = false;
  // Call the agent contract to get a signature for the payload
  try {
    const path = "ethereum-1";
    const payload = hashesToSign[0];
    signRes = await signWithAgent(path, payload);
    console.log("signRes", signRes);
    verified = true;
  } catch (e) {
    console.log("Contract call error:", e);
  }

  if (!verified) {
    res.status(400).json({
      verified,
      error: "Failed to get signature verification from MPC nodes",
    });
    return;
  }

  // Reconstruct the signed transaction
  const signedTransaction = storyEVM.finalizeTransactionSigning({
    transaction,
    rsvSignatures: [toRSV(signRes)],
  });

  // Broadcast the signed transaction
  const { hash: txHash } = await storyEVM.broadcastTx(signedTransaction);

  console.log("TxHash ", txHash);

  const receipt = await storyPublicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  const ipId = `0x${receipt.logs[3].topics[1].slice(26)}`;

  return { ipId, txHash };
}
