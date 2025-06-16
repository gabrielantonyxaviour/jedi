import { NextResponse } from "next/server";
import { signWithAgent } from "@neardefi/shade-agent-js";
import {
  ethContractAbi,
  ethContractAddress,
  ethRpcUrl,
  Evm,
} from "../../../utils/ethereum";
import { getEthereumPriceUSD } from "../../../utils/fetch-eth-price";
import { Contract, JsonRpcProvider } from "ethers";
import { utils } from "chainsig.js";
const { toRSV } = utils.cryptography;

const contractId = process.env.NEXT_PUBLIC_contractId;

export async function POST(req) {
  try {
    // Get the ETH price
    const ethPrice = await getEthereumPriceUSD();

    // Get the transaction and payload to sign
    const { transaction, hashesToSign } = await getPricePayload(ethPrice);

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
      return NextResponse.json(
        { verified, error: "Failed to send price" },
        { status: 400 }
      );
    }

    // Reconstruct the signed transaction
    const signedTransaction = Evm.finalizeTransactionSigning({
      transaction,
      rsvSignatures: [toRSV(signRes)],
    });

    // Broadcast the signed transaction
    const txHash = await Evm.broadcastTx(signedTransaction);

    // Send back both the txHash and the new price optimistically
    return NextResponse.json(
      {
        txHash: txHash.hash,
        newPrice: (ethPrice / 100).toFixed(2),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in send-transaction POST:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function getPricePayload(ethPrice) {
  const { address: senderAddress } = await Evm.deriveAddressAndPublicKey(
    contractId,
    "ethereum-1"
  );
  const provider = new JsonRpcProvider(ethRpcUrl);
  const contract = new Contract(ethContractAddress, ethContractAbi, provider);
  const data = contract.interface.encodeFunctionData("updatePrice", [ethPrice]);
  const { transaction, hashesToSign } = await Evm.prepareTransactionForSigning({
    from: senderAddress,
    to: ethContractAddress,
    data,
  });

  return { transaction, hashesToSign };
}
