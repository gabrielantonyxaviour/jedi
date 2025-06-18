// hooks/use-agent-interactions.ts
import { AgentInteraction } from "@/components/layout/logs-sheet";
import { useQuery } from "@tanstack/react-query";

const fetchAgentInteractions = async (
  projectId: string
): Promise<AgentInteraction[]> => {
  const response = await fetch(`/api/projects/${projectId}/agent-interactions`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.interactions || [];
};

export const useAgentInteractions = (projectId: string) => {
  return useQuery({
    queryKey: ["agent-interactions", projectId],
    queryFn: () => fetchAgentInteractions(projectId),
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });
};
