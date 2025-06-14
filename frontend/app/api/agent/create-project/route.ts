import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { repoUrl, walletAddress, side = "light" } = body;

    const response = await fetch("http://localhost:3000/api/projects/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repoUrl,
        walletAddress,
        side,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to create project");
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create project" },
      { status: 500 }
    );
  }
}
