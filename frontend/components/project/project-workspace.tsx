"use client";

import { useState, useRef } from "react";
import { useDrop } from "react-dnd";
import DraggableContainer from "./draggable-container";
import GitHubAgent from "./agents/github";
import SocialsAgent from "./agents/socials";
import LeadsAgent from "./agents/leads";
import IPAgent from "./agents/ip";
import ComplianceAgent from "./agents/compliance";
import KarmaAgent from "./agents/karma";

interface ContainerPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ProjectWorkspaceProps {
  activeContainers: string[];
  userSide: "light" | "dark" | null;
}

const agentComponents = {
  github: GitHubAgent,
  socials: SocialsAgent,
  leads: LeadsAgent,
  ip: IPAgent,
  compliance: ComplianceAgent,
  karma: KarmaAgent,
};

export default function ProjectWorkspace({
  activeContainers,
  userSide,
}: ProjectWorkspaceProps) {
  const [containerPositions, setContainerPositions] = useState<
    ContainerPosition[]
  >([]);
  const dropRef = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop<
    { id: string },
    unknown,
    { isOver: boolean }
  >({
    accept: "container",
    drop: (item: { id: string }, monitor) => {
      const offset = monitor.getClientOffset();
      if (offset) {
        const workspaceRect = document
          .getElementById("workspace")
          ?.getBoundingClientRect();
        if (workspaceRect) {
          const x = offset.x - workspaceRect.left;
          const y = offset.y - workspaceRect.top;

          setContainerPositions((prev) => {
            const existing = prev.find((p) => p.id === item.id);
            if (existing) {
              return prev.map((p) => (p.id === item.id ? { ...p, x, y } : p));
            }
            return [...prev, { id: item.id, x, y, width: 400, height: 300 }];
          });
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const getGridLayout = (containerCount: number) => {
    if (containerCount === 1) return { cols: 1, rows: 1 };
    if (containerCount === 2) return { cols: 2, rows: 1 };
    if (containerCount === 3) return { cols: 3, rows: 1 };
    return { cols: 2, rows: 2 };
  };

  const getAutoPosition = (index: number, total: number) => {
    const { cols } = getGridLayout(total);
    const containerWidth = window.innerWidth / cols;
    const containerHeight =
      (window.innerHeight - 200) / Math.ceil(total / cols);

    const col = index % cols;
    const row = Math.floor(index / cols);

    return {
      x: col * containerWidth,
      y: row * containerHeight + 100,
      width: containerWidth - 20,
      height: containerHeight - 20,
    };
  };

  return (
    <div
      id="workspace"
      ref={(node) => {
        dropRef.current = node;
        drop(node);
      }}
      className={`absolute inset-0 pt-20 pb-32 ${
        isOver ? "bg-gray-900/20" : ""
      }`}
    >
      {activeContainers.map((containerId, index) => {
        let position = containerPositions.find((p) => p.id === containerId);

        if (!position) {
          const autoPos = getAutoPosition(index, activeContainers.length);
          position = {
            id: containerId,
            ...autoPos,
          };
        }

        const AgentComponent =
          agentComponents[containerId as keyof typeof agentComponents];

        return (
          <DraggableContainer
            key={containerId}
            id={containerId}
            position={position}
            userSide={userSide}
            onClose={() => {
              // Remove from active containers
            }}
          >
            <AgentComponent userSide={userSide} />
          </DraggableContainer>
        );
      })}
    </div>
  );
}
