import { NextResponse } from "next/server";
import { Evm } from "../../../utils/ethereum";

const contractId = process.env.NEXT_PUBLIC_contractId;

export async function GET() {
  try {
    const { address: senderAddress } = await Evm.deriveAddressAndPublicKey(
      contractId,
      "ethereum-1"
    );
    return NextResponse.json({ senderAddress }, { status: 200 });
  } catch (error) {
    console.log("Error getting worker account:", error);
    return NextResponse.json(
      { error: "Failed to get worker account" },
      { status: 500 }
    );
  }
}
