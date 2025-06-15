import { NextRequest } from "next/server";
import { fetchSocials } from "@/services/socials";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const allData = await fetchSocials();
    const data = allData.filter((item) => item.project_id === projectId);
    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: "Failed to fetch socials data" },
      { status: 500 }
    );
  }
}
