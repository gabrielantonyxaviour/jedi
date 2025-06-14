// app/api/purchase/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { PurchaseInput, ApiError } from "@/types/job";

export async function POST(
  request: NextRequest
): Promise<NextResponse<any | ApiError>> {
  try {
    const body: PurchaseInput = await request.json();
    const {
      identifierFromPurchaser,
      network = "Preprod",
      sellerVkey,
      paymentType = "Web3CardanoV1",
      blockchainIdentifier,
      submitResultTime,
      unlockTime,
      externalDisputeUnlockTime,
      agentIdentifier,
      inputHash,
    } = body;

    const requiredFields: (keyof PurchaseInput)[] = [
      "identifierFromPurchaser",
      "sellerVkey",
      "blockchainIdentifier",
      "submitResultTime",
      "unlockTime",
      "externalDisputeUnlockTime",
      "agentIdentifier",
      "inputHash",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const response = await fetch(
      "https://payment.masumi.network/api/v1/purchase/",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          token:
            process.env.MASUMI_TOKEN || "iofsnaiojdoiewqajdriknjonasfoinasd",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifierFromPurchaser,
          network,
          sellerVkey,
          paymentType,
          blockchainIdentifier,
          submitResultTime,
          unlockTime,
          externalDisputeUnlockTime,
          agentIdentifier,
          inputHash,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Payment API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Purchase error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
