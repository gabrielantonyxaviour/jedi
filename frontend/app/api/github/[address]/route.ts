import { NextRequest } from "next/server";
import { fetchGithubByAddress } from "@/services/github";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const data = await fetchGithubByAddress(address);
    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: "Failed to fetch github data" },
      { status: 500 }
    );
  }
}
