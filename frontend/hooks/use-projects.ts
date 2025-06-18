// hooks/use-projects.ts
import { useState, useEffect, useCallback } from "react";
import { ProjectInfo } from "@/lib/types";

export const useProjects = (ownerAddress?: string) => {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const fetchProjects = useCallback(async (address: string) => {
    if (!address) return [];

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects?owner=${encodeURIComponent(address.toLowerCase())}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const fetchedProjects: ProjectInfo[] = data.projects || [];
      setProjects(fetchedProjects);
      return fetchedProjects;
    } catch (err) {
      console.error("Error fetching projects:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch projects";
      setError(errorMessage);
      setProjects([]);
      return [];
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (ownerAddress && !initialized) {
      fetchProjects(ownerAddress);
    } else if (ownerAddress && initialized) {
      fetchProjects(ownerAddress);
    }
  }, [ownerAddress, fetchProjects]);

  const refetch = useCallback(() => {
    if (ownerAddress) {
      return fetchProjects(ownerAddress);
    }
    return Promise.resolve([]);
  }, [ownerAddress, fetchProjects]);

  return {
    projects,
    loading,
    error,
    initialized,
    fetchProjects,
    refetch,
  };
};
