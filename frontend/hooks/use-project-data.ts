// hooks/useProjectData.ts
"use client";

import { useEffect, useState } from "react";

export function useProjectData(projectId: string) {
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [githubProjects, setGithubProjects] = useState<any>(null);
  const [leads, setLeads] = useState<any>(null);
  const [stories, setStories] = useState<any>(null);
  const [socials, setSocials] = useState<any>(null);
  const [grants, setGrants] = useState<any>(null);
  const [compliance, setCompliance] = useState<any>(null);
  const [logs, setLogs] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const fetchData = async () => {
      // try {
      //   const res = await fetch(`/api/project?projectId=${projectId}`);
      //   const json = await res.json();
      //   if (!res.ok) {
      //     throw new Error(json.error || "Failed to fetch project data");
      //   }
      //   setCurrentProject(json.currentProject);
      //   setGithubProjects(json.githubProjects);
      //   setLeads(json.leads);
      //   setStories(json.stories);
      //   setSocials(json.socials);
      //   setGrants(json.grants);
      //   setCompliance(json.compliance);
      //   setLogs(json.logs);
      //   setError(null);
      // } catch (err: any) {
      //   setError(err.message || "Unexpected error");
      // } finally {
      //   setLoading(false);
      // }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // every 5 seconds

    return () => clearInterval(interval);
  }, [projectId]);

  // useEffect(() => {
  //   if (!projectId) return;

  //   const fetchData = async () => {
  //     try {
  //       const res = await fetch(`/api/project?projectId=${projectId}`);
  //       const json = await res.json();

  //       if (!res.ok) {
  //         throw new Error(json.error || "Failed to fetch project data");
  //       }

  //       setData(json);
  //       setError(null);
  //     } catch (err: any) {
  //       setError(err.message || "Unexpected error");
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchData();
  //   const interval = setInterval(fetchData, 5000); // every 5 seconds

  //   return () => clearInterval(interval);
  // }, [projectId]);

  return {
    currentProject,
    githubProjects,
    leads,
    stories,
    socials,
    grants,
    compliance,
    logs,
    loading,
    error,
  };
}
