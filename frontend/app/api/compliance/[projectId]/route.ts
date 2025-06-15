import { NextRequest } from "next/server";
import { fetchCompliance } from "@/services/compliance";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const allData = await fetchCompliance();
    const data = allData.filter((item) => item.project_id === projectId);
    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: "Failed to fetch compliance data" },
      { status: 500 }
    );
  }
}
