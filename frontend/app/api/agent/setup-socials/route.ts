import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      projectId,
      twitter,
      linkedin,
      telegram,
      autoPost,
      character,
      postsPerDay,
    } = body;

    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/setup-socials`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          twitter,
          linkedin,
          telegram,
          autoPost,
          character,
          postsPerDay,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to setup socials");
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to setup socials" },
      { status: 500 }
    );
  }
}
