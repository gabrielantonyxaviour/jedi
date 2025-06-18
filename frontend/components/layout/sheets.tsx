"use client";

import LogsSheet from "@/components/layout/logs-sheet";
import ProjectsSheet from "@/components/layout/projects-sheet";
import { useAppStore } from "@/store/app-store";
import { ProjectInfo } from "@/lib/types";

export default function Sheets({ projects }: { projects: ProjectInfo[] }) {
  const { userSide, agentInteractions } = useAppStore();

  if (!userSide) return null;

  return (
    <>
      <LogsSheet interactions={agentInteractions} side={userSide} />
      <ProjectsSheet side={userSide} projects={projects} />
    </>
  );
}
