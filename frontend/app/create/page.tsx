"use client";
import { useParams } from "next/navigation";
import { useProjectData } from "@/hooks/useProjectData";

export default function CreateProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data, loading, fetchGithubProjects } = useProjectData(
    projectId,
    true
  );

  const handleFetchGithub = async () => {
    const projects = await fetchGithubProjects("0x1234...");
    console.log("Github projects:", projects);
  };

  return (
    <div>
      {data.creating && <div>Current step: {data.creating.init_step}</div>}
      <button onClick={handleFetchGithub}>Fetch GitHub Projects</button>
    </div>
  );
}
