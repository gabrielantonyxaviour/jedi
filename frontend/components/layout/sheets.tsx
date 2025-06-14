"use client";

import LogsSheet from "@/components/layout/logs-sheet";
import ProjectsSheet from "@/components/layout/projects-sheet";
import { useAppStore } from "@/store/app-store";
import { Project } from "@/hooks/use-projects";

export default function Sheets({ projects }: { projects: Project[] }) {
  const { userSide, logs } = useAppStore();

  if (!userSide) return null;

  return (
    <>
      <LogsSheet logs={logs} side={userSide} />
      <ProjectsSheet side={userSide} projects={projects} />
    </>
  );
}
