// hooks/use-projects.ts
import { useQuery } from "@tanstack/react-query";
import { ProjectInfo } from "@/lib/types";

const fetchProjects = async (ownerAddress: string): Promise<ProjectInfo[]> => {
  if (!ownerAddress) return [];

  const response = await fetch(
    `/api/projects?owner=${encodeURIComponent(ownerAddress.toLowerCase())}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.projects || [];
};

export const useProjects = (ownerAddress?: string) => {
  const query = useQuery({
    queryKey: ["projects", ownerAddress?.toLowerCase()],
    queryFn: () => fetchProjects(ownerAddress!),
    enabled: !!ownerAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const fetchProjectById = (projectId: string): ProjectInfo | null => {
    return (
      query.data?.find((project) => project.projectId === projectId) || null
    );
  };

  return {
    ...query,
    projects: query.data || [],
    fetchProjectById,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
};
