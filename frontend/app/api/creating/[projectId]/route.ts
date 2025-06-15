import { NextRequest } from "next/server";
import { fetchCreating } from "@/services/creating";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const allData = await fetchCreating();
    const data = allData.find((item) => item.address === projectId);
    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: "Failed to fetch creating data" },
      { status: 500 }
    );
  }
}
