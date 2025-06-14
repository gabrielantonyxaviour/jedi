import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");

    if (!owner) {
      return NextResponse.json(
        { error: "Owner address required" },
        { status: 400 }
      );
    }

    const command = new QueryCommand({
      TableName: "projects",
      IndexName: "owner-index",
      KeyConditionExpression: "#owner = :owner",
      ExpressionAttributeNames: {
        "#owner": "owner", // Map reserved keyword to attribute name
      },
      ExpressionAttributeValues: {
        ":owner": owner,
      },
    });

    const response = await docClient.send(command);
    const projects = response.Items || [];

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("DynamoDB error:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
