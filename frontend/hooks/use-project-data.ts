// hooks/useProjectData.ts
"use client";

import { useEffect, useState } from "react";

export function useProjectData(projectId: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return { data, loading, error };
}
