import { NextResponse } from "next/server";
import { getAgentAccount, getBalance } from "@neardefi/shade-agent-js";

export async function GET() {
  try {
    const accountId = await getAgentAccount();
    console.log("Worker account:", accountId.workerAccountId);
    const balance = await getBalance(accountId.workerAccountId);
    console.log("Balance:", balance.available);
    return NextResponse.json(
      {
        accountId: accountId.workerAccountId,
        balance: balance.available,
      },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error getting worker account:", error);
    return NextResponse.json(
      { error: "Failed to get worker account " + error },
      { status: 500 }
    );
  }
}
