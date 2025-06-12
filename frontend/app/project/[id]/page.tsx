"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import NeonIsometricMaze from "@/components/neon-isometric-maze";
import DraggableContainer from "@/components/project/draggable-container";
import GitHubAgent from "@/components/project/agents/github";
import SocialsAgent from "@/components/project/agents/socials";
import LeadsAgent from "@/components/project/agents/leads";
import IPAgent from "@/components/project/agents/ip";
import ComplianceAgent from "@/components/project/agents/compliance";
import KarmaAgent from "@/components/project/agents/karma";
import ChatDialog from "@/components/project/chat-dialog";
import {
  Github,
  TrendingUp,
  Target,
  Shield,
  FileText,
  Heart,
  MessageCircle,
} from "lucide-react";

interface AgentConfig {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  component: React.ComponentType<any>;
}

interface ContainerPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

const agents: AgentConfig[] = [
  { id: "github", name: "GitHub", icon: Github, component: GitHubAgent },
  { id: "socials", name: "Socials", icon: TrendingUp, component: SocialsAgent },
  { id: "leads", name: "Leads", icon: Target, component: LeadsAgent },
  { id: "ip", name: "IP", icon: Shield, component: IPAgent },
  {
    id: "compliance",
    name: "Compliance",
    icon: FileText,
    component: ComplianceAgent,
  },
  { id: "karma", name: "Karma", icon: Heart, component: KarmaAgent },
];

export default function ProjectPage() {
  const searchParams = useSearchParams();
  const userSide = (searchParams?.get("side") as "light" | "dark") || null;
  const [activeContainers, setActiveContainers] = useState<string[]>([]);
  const [containerPositions, setContainerPositions] = useState<
    Record<string, ContainerPosition>
  >({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [maxContainers] = useState(3);

  useEffect(() => {
    const handleResize = () => {
      // Recalculate positions if needed
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getInitialPosition = (index: number): ContainerPosition => {
    const padding = 20;
    const availableWidth = window.innerWidth - padding * 2;
    const containerWidth = Math.floor(
      (availableWidth - padding * (maxContainers - 1)) / maxContainers
    );
    const containerHeight = 700;
    const startX = padding;
    const startY = padding + 80;

    return {
      x: startX + index * (containerWidth + padding),
      y: startY,
      width: containerWidth,
      height: containerHeight,
    };
  };

  // Add window resize handler to recalculate positions
  useEffect(() => {
    const handleResize = () => {
      const newPositions: Record<string, ContainerPosition> = {};
      activeContainers.forEach((agentId, index) => {
        newPositions[agentId] = getInitialPosition(index);
      });
      setContainerPositions(newPositions);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeContainers, maxContainers]);

  const handleAgentClick = (agentId: string) => {
    if (activeContainers.includes(agentId)) {
      // Close container
      setActiveContainers((prev) => prev.filter((id) => id !== agentId));
      setContainerPositions((prev) => {
        const newPositions = { ...prev };
        delete newPositions[agentId];
        return newPositions;
      });
    } else if (activeContainers.length < maxContainers) {
      // Open container
      const newIndex = activeContainers.length;
      setActiveContainers((prev) => [...prev, agentId]);
      setContainerPositions((prev) => ({
        ...prev,
        [agentId]: getInitialPosition(newIndex),
      }));
    }
  };

  const handleContainerClose = (agentId: string) => {
    setActiveContainers((prev) => prev.filter((id) => id !== agentId));
    setContainerPositions((prev) => {
      const newPositions = { ...prev };
      delete newPositions[agentId];
      return newPositions;
    });
  };

  const isAgentDisabled = (agentId: string) => {
    return (
      !activeContainers.includes(agentId) &&
      activeContainers.length >= maxContainers
    );
  };

  return (
    <>
      <NeonIsometricMaze />
      <div className="absolute w-screen inset-0 min-h-screen">
        <DndProvider backend={HTML5Backend}>
          {/* Agent Orbs */}

          {/* Workspace */}
          <div id="workspace" className="relative w-full h-screen pt-20">
            {activeContainers.map((agentId) => {
              const agent = agents.find((a) => a.id === agentId);
              if (!agent) return null;

              const AgentComponent = agent.component;
              const position = containerPositions[agentId];

              return (
                <DraggableContainer
                  key={agentId}
                  id={agentId}
                  position={position}
                  userSide={userSide}
                  onClose={() => handleContainerClose(agentId)}
                >
                  <AgentComponent userSide={userSide} />
                </DraggableContainer>
              );
            })}
          </div>

          {/* Chat Dialog */}
          {isChatOpen && (
            <ChatDialog
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
              userSide={userSide}
            />
          )}

          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 z-20">
            {agents.map((agent, index) => {
              const Icon = agent.icon;
              const isActive = activeContainers.includes(agent.id);
              const isDisabled = isAgentDisabled(agent.id);

              return (
                <button
                  key={agent.id}
                  onClick={() => handleAgentClick(agent.id)}
                  disabled={isDisabled}
                  className={`relative p-4 rounded-full transition-all duration-300 ${
                    isActive
                      ? userSide === "light"
                        ? "bg-stone-800/90 border-2 border-blue-500 shadow-lg shadow-blue-500/25"
                        : "bg-stone-800/90 border-2 border-red-500 shadow-lg shadow-red-500/25"
                      : isDisabled
                      ? "bg-stone-800/50 border border-stone-700 opacity-50 cursor-not-allowed"
                      : "bg-stone-800/80 border border-stone-600 hover:border-stone-500"
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 ${
                      isActive
                        ? userSide === "light"
                          ? "text-blue-400"
                          : "text-red-400"
                        : isDisabled
                        ? "text-stone-600"
                        : "text-stone-400"
                    }`}
                  />

                  {/* Tooltip */}
                  <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-stone-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {agent.name}
                  </div>
                </button>
              );
            })}

            {/* Chat Orb */}
            <button
              onClick={() => setIsChatOpen(true)}
              className={`relative p-4 rounded-full transition-all duration-300 bg-stone-800/80 border border-stone-600 hover:border-stone-500 ml-8`}
            >
              <MessageCircle className="w-6 h-6 text-stone-400" />

              {/* Tooltip */}
              <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-stone-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Chat
              </div>
            </button>
          </div>
        </DndProvider>
      </div>
    </>
  );
}
