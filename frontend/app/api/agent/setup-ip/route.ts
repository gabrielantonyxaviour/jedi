import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      projectId,
      title,
      description,
      imageURL,
      remixFee,
      commercialRevShare,
    } = body;

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/setup-ip`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          imageURL,
          remixFee,
          commercialRevShare,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to setup IP");
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to setup IP" },
      { status: 500 }
    );
  }
}
