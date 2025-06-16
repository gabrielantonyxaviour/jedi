import { NextResponse } from "next/server";
import { registerProject } from "../../../utils/karma/register";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      title = "Test",
      description = "Test",
      imageURL = "https://via.placeholder.com/150",
      creators = [{ address: "0x0429A2Da7884CA14E53142988D5845952fE4DF6a" }],
      links = [],
      tags = [],
    } = body || {};
    const response = await registerProject({
      title,
      description,
      imageURL,
      creators,
      links,
      tags,
    });
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
