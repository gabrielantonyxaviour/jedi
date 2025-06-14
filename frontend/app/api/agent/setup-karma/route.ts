import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      projectId,
      title,
      description,
      imageURL,
      ownerAddress,
      ownerPkey,
      members,
      membersPKey,
      userEmail,
      userName,
    } = body;

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/setup-karma`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          imageURL,
          ownerAddress,
          ownerPkey,
          members,
          membersPKey,
          userEmail,
          userName,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to setup karma");
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to setup karma" },
      { status: 500 }
    );
  }
}
