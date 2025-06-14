// hooks/use-projects.ts - Updated to use API calls
import { useState, useEffect, useCallback } from "react";

export interface Project {
  id: string;
  owner: string;
  side: "light" | "dark";
  [key: string]: any;
}

export const useProjects = (ownerAddress?: string) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const fetchProjects = useCallback(async (address: string) => {
    if (!address) return [];

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects?owner=${encodeURIComponent(address)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const fetchedProjects = data.projects || [];
      setProjects(fetchedProjects);
      return fetchedProjects;
    } catch (err) {
      console.error("Error fetching projects:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch projects");
      return [];
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

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
