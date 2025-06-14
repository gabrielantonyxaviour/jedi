import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, name, description, technicalDescription, imageUrl } =
      body;

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/setup-info`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          technicalDescription,
          imageUrl,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to setup project");
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to setup project" },
      { status: 500 }
    );
  }
}
