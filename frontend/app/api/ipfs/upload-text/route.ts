import { NextResponse } from "next/server";
import { uploadTextToIPFS } from "../../../../utils/pinata";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json(
        { error: "Text content is required" },
        { status: 400 }
      );
    }
    const ipfsHash = await uploadTextToIPFS(text);
    return NextResponse.json({ ipfsHash });
  } catch (error) {
    console.error("Error in upload-text route:", error);
    return NextResponse.json(
      { error: "Failed to upload text to IPFS" },
      { status: 500 }
    );
  }
}
