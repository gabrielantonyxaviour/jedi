// hooks/useProjects.ts - Updated with auto-fetch
import { useState, useEffect, useCallback } from "react";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

interface Project {
  id: string;
  owner: string;
  side: "light" | "dark";
  [key: string]: any;
}

const client = new DynamoDBClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

export const useProjects = (ownerAddress?: string) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const fetchProjects = useCallback(async (address: string) => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const command = new QueryCommand({
        TableName: "projects",
        IndexName: "owner-index",
        KeyConditionExpression: "owner = :owner",
        ExpressionAttributeValues: {
          ":owner": address,
        },
      });

      const response = await docClient.send(command);
      const fetchedProjects = (response.Items as Project[]) || [];
      setProjects(fetchedProjects);
      return fetchedProjects;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects");
      return [];
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  // Auto-fetch when address is provided
  useEffect(() => {
    if (ownerAddress && !initialized) {
      fetchProjects(ownerAddress);
    }
  }, [ownerAddress, initialized, fetchProjects]);

  return {
    projects,
    loading,
    error,
    initialized,
    fetchProjects,
    refetch: () => ownerAddress && fetchProjects(ownerAddress),
  };
};
