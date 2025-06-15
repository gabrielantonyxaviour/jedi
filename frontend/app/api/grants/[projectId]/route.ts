import { NextRequest } from "next/server";
import { fetchGrants } from "@/services/grants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const allData = await fetchGrants();
    const data = allData.filter((item) => item.project_id === projectId);
    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: "Failed to fetch grants data" },
      { status: 500 }
    );
  }
}
