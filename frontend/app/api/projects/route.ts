// app/api/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ProjectInfo } from "@/lib/types";

const dynamodb = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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

    // Query by ownerId (assuming this maps to wallet address)
    const response = await dynamodb.send(
      new ScanCommand({
        TableName: process.env.PROJECTS_TABLE_NAME!,
        FilterExpression: "ownerId = :owner OR karma.ownerAddress = :owner",
        ExpressionAttributeValues: marshall({
          ":owner": owner.toLowerCase(),
        }),
      })
    );

    const projects: ProjectInfo[] = (response.Items || []).map((item) => {
      const project = unmarshall(item);

      // Ensure the project conforms to ProjectInfo structure
      return {
        projectId: project.projectId,
        name: project.name,
        description: project.description,
        technicalDescription: project.technicalDescription,
        imageUrl: project.imageUrl,

        // GitHub Integration
        githubUrl: project.githubUrl,
        repo: project.repo,
        developers: project.developers || [],
        languages: project.languages,

        // Project Metadata
        ownerId: project.ownerId,
        side: project.side || "light",
        summary: project.summary,
        technicalSummary: project.technicalSummary,
        industry: project.industry,
        keywords: project.keywords,

        // Setup Progress
        setup_state: project.setup_state || "GITHUB",
        setup_completed_steps: project.setup_completed_steps || [],
        setup_started_at: project.setup_started_at,
        setup_completed_at: project.setup_completed_at,

        // All the other optional properties
        socials: project.socials,
        karma: project.karma,
        ip: project.ip,
        compliance: project.compliance,
        leads: project.leads,
        stats: project.stats,

        // Timestamps
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        metadata: project.metadata,

        ...project, // Spread any additional properties
      } as ProjectInfo;
    });

    return NextResponse.json({
      projects,
      count: projects.length,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
