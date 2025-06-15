import { useState, useEffect, useCallback, useRef } from "react";
import {
  ComplianceData,
  SocialsData,
  StoriesData,
  LogsData,
  GrantsData,
  CreatingData,
  GithubData,
} from "@/types";

interface ProjectData {
  compliance: ComplianceData[];
  socials: SocialsData[];
  stories: StoriesData[];
  logs: LogsData[];
  grants: GrantsData[];
  creating: CreatingData | null;
}

interface LoadingState {
  compliance: boolean;
  socials: boolean;
  stories: boolean;
  logs: boolean;
  grants: boolean;
  creating: boolean;
  github: boolean;
}

const initialData: ProjectData = {
  compliance: [],
  socials: [],
  stories: [],
  logs: [],
  grants: [],
  creating: null,
};

const initialLoading: LoadingState = {
  compliance: false,
  socials: false,
  stories: false,
  logs: false,
  grants: false,
  creating: false,
  github: false,
};

export function useProjectData(projectId?: string, isCreating?: boolean) {
  const [data, setData] = useState<ProjectData>(initialData);
  const [loading, setLoading] = useState<LoadingState>(initialLoading);
  const [githubData, setGithubData] = useState<GithubData[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const creatingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProjectData = useCallback(async (id: string) => {
    const endpoints = ["compliance", "socials", "stories", "logs", "grants"];

    const promises = endpoints.map(async (endpoint) => {
      try {
        const response = await fetch(`/api/${endpoint}/${id}`);
        const result = await response.json();
        return { endpoint, data: result.success ? result.data : [] };
      } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        return { endpoint, data: [] };
      }
    });

    const results = await Promise.all(promises);

    setData((prev) => {
      const updated = { ...prev };
      results.forEach(({ endpoint, data }) => {
        updated[endpoint as keyof Omit<ProjectData, "creating">] = data;
      });
      return updated;
    });

    setLoading((prev) => ({
      ...prev,
      compliance: false,
      socials: false,
      stories: false,
      logs: false,
      grants: false,
    }));
  }, []);

  const fetchCreatingData = useCallback(async (id: string) => {
    try {
      setLoading((prev) => ({ ...prev, creating: true }));
      const response = await fetch(`/api/creating/${id}`);
      const result = await response.json();

      const creatingData = result.success ? result.data : null;
      setData((prev) => ({ ...prev, creating: creatingData }));

      // Stop polling if creation is complete
      if (!creatingData || creatingData.init_step === "ip") {
        if (creatingIntervalRef.current) {
          clearInterval(creatingIntervalRef.current);
          creatingIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error("Error fetching creating data:", error);
    } finally {
      setLoading((prev) => ({ ...prev, creating: false }));
    }
  }, []);

  const fetchGithubProjects = useCallback(async (address: string) => {
    try {
      setLoading((prev) => ({ ...prev, github: true }));
      const response = await fetch(`/api/github/${address}`);
      const result = await response.json();

      if (result.success) {
        setGithubData(result.data);
      }
      return result.data || [];
    } catch (error) {
      console.error("Error fetching github data:", error);
      return [];
    } finally {
      setLoading((prev) => ({ ...prev, github: false }));
    }
  }, []);

  // Start/stop project data polling
  useEffect(() => {
    if (!projectId) return;

    setLoading((prev) => ({
      ...prev,
      compliance: true,
      socials: true,
      stories: true,
      logs: true,
      grants: true,
    }));

    // Initial fetch
    fetchProjectData(projectId);

    // Set up polling
    intervalRef.current = setInterval(() => {
      fetchProjectData(projectId);
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [projectId, fetchProjectData]);

  // Start/stop creating data polling
  useEffect(() => {
    if (!isCreating || !projectId) {
      if (creatingIntervalRef.current) {
        clearInterval(creatingIntervalRef.current);
        creatingIntervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchCreatingData(projectId);

    // Set up polling
    creatingIntervalRef.current = setInterval(() => {
      fetchCreatingData(projectId);
    }, 5000);

    return () => {
      if (creatingIntervalRef.current) {
        clearInterval(creatingIntervalRef.current);
      }
    };
  }, [isCreating, projectId, fetchCreatingData]);

  return {
    data,
    loading,
    githubData,
    fetchGithubProjects,
    refetch: projectId ? () => fetchProjectData(projectId) : undefined,
  };
}
