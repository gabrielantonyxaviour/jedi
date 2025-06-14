// app/api/start_job/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { JobInput, JobResponse, ApiError } from "@/types/job";

export async function POST(
  request: NextRequest
): Promise<NextResponse<JobResponse | ApiError>> {
  try {
    const body: JobInput = await request.json();
    const { identifier_from_purchaser, input_data } = body;

    if (!identifier_from_purchaser || !input_data) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("body", body);

    const response = await fetch("http://0.0.0.0:8000/start_job", {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`External API error: ${response.status}`);
    }

    const data: JobResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Start job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
