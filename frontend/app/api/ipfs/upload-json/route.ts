import { NextResponse } from "next/server";
import { uploadJSONToIPFS } from "../../../../utils/pinata";

export async function POST(req: Request) {
  try {
    const jsonData = await req.json();
    const ipfsHash = await uploadJSONToIPFS(jsonData);
    return NextResponse.json({ ipfsHash });
  } catch (error) {
    console.error("Error in upload-json route:", error);
    return NextResponse.json(
      { error: "Failed to upload JSON to IPFS" },
      { status: 500 }
    );
  }
}
