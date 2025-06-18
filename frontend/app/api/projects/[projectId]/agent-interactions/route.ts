import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamodb = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const { searchParams } = new URL(request.url);

    // Optional filters
    const limit = parseInt(searchParams.get("limit") || "100");
    const sourceAgent = searchParams.get("sourceAgent");
    const type = searchParams.get("type");
    const since = searchParams.get("since"); // timestamp

    let filterExpression = "projectId = :projectId";
    const expressionAttributeValues: any = { ":projectId": projectId };

    if (sourceAgent) {
      filterExpression += " AND sourceAgent = :sourceAgent";
      expressionAttributeValues[":sourceAgent"] = sourceAgent;
    }

    if (type) {
      filterExpression += " AND #type = :type";
      expressionAttributeValues[":type"] = type;
    }

    if (since) {
      filterExpression += " AND #timestamp >= :since";
      expressionAttributeValues[":since"] = since;
    }

    const response = await dynamodb.send(
      new QueryCommand({
        TableName: process.env.AGENT_INTERACTIONS_TABLE_NAME!,
        KeyConditionExpression: "projectId = :projectId",
        FilterExpression: filterExpression,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        ExpressionAttributeNames: {
          "#type": "type",
          "#timestamp": "timestamp",
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
      })
    );

    const interactions = (response.Items || []).map((item) => unmarshall(item));

    return NextResponse.json({
      interactions,
      count: interactions.length,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent interactions" },
      { status: 500 }
    );
  }
}
