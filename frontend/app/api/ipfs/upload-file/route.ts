import { NextResponse } from "next/server";
import { uploadFileToIPFS } from "../../../../utils/pinata";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const ipfsHash = await uploadFileToIPFS(Buffer.from(buffer), file.name);
    const ipfsUri = `ipfs://${ipfsHash}`;

    return NextResponse.json({ ipfsUri });
  } catch (error) {
    console.error("Error in upload-file route:", error);
    return NextResponse.json(
      { error: "Failed to upload file to IPFS" },
      { status: 500 }
    );
  }
}
