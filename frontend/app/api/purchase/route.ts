import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    // Validate required fields
    const requiredFields = [
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

    // Call external payment API
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
