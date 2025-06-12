"use client";

import { useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import ProjectOrbs from "@/components/project/project-orbs";
import ProjectWorkspace from "@/components/project/project-workspace";
import { useAppStore } from "@/store/app-store";

export default function ProjectPage() {
  const { userSide } = useAppStore();
  const [activeContainers, setActiveContainers] = useState<string[]>([]);
  const [showChat, setShowChat] = useState(false);

  const handleOrbClick = (orbId: string) => {
    if (activeContainers.includes(orbId)) {
      setActiveContainers((prev) => prev.filter((id) => id !== orbId));
    } else {
      setActiveContainers((prev) => [...prev, orbId]);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Background with neon effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />

        {/* Main workspace */}
        <ProjectWorkspace
          activeContainers={activeContainers}
          userSide={userSide}
        />

        {/* Bottom orbs navigation */}
        <ProjectOrbs
          onOrbClick={handleOrbClick}
          onChatClick={() => setShowChat(true)}
          activeContainers={activeContainers}
          userSide={userSide}
        />
      </div>
    </DndProvider>
  );
}
