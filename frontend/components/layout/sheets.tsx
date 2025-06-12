"use client";

import LogsSheet from "@/components/layout/logs-sheet";
import ProjectsSheet from "@/components/layout/projects-sheet";
import { useAppStore } from "@/store/app-store";

export default function Sheets() {
  const { userSide, logs } = useAppStore();

  if (!userSide) return null;

  return (
    <>
      <LogsSheet logs={logs} side={userSide} />
      <ProjectsSheet
        side={userSide}
        projects={[
          { id: "1", name: "Project 1", imageUrl: "/light-projects.png" },
          { id: "2", name: "Project 2", imageUrl: "/dark-projects.png" },
        ]}
      />
    </>
  );
}
