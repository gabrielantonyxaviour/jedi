"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useParams } from "next/navigation";
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
import Image from "next/image";
import { useAppStore } from "@/store/app-store";
import { useProjectData } from "@/hooks/use-project-data";

interface AgentConfig {
  id: string;
  name: string;
  component: React.ComponentType<any>;
}

interface ContainerPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

const agents: AgentConfig[] = [
  { id: "github", name: "GitHub", component: GitHubAgent },
  { id: "socials", name: "Socials", component: SocialsAgent },
  { id: "leads", name: "Leads", component: LeadsAgent },
  { id: "ip", name: "IP", component: IPAgent },
  {
    id: "compliance",
    name: "Compliance",
    component: ComplianceAgent,
  },
  { id: "karma", name: "Karma", component: KarmaAgent },
];

const getEnabledAgents = (initState: string): string[] => {
  switch (initState) {
    case "GITHUB":
      return ["github"];
    case "SETUP":
      return ["github", "leads"];
    case "SOCIALS":
      return ["github", "leads", "socials"];
    case "KARMA":
      return ["github", "leads", "socials", "karma"];
    case "IP":
      return ["github", "leads", "socials", "karma", "ip"];
    default:
      return ["github", "leads", "socials", "karma", "ip", "compliance"];
  }
};

const getBlinkingAgent = (initState: string): string | null => {
  switch (initState) {
    case "GITHUB":
      return "leads";
    case "SETUP":
      return "socials";
    case "SOCIALS":
      return "karma";
    case "KARMA":
      return "ip";
    default:
      return null;
  }
};
interface PageProps {
  params: {
    id: string;
  };
}

export default function ProjectPage() {
  const { id } = useParams();
  const { userSide } = useAppStore();
  const [activeContainers, setActiveContainers] = useState<string[]>([]);
  const [isSocialSetup, setIsSocialSetup] = useState(false);
  const [isIpSetup, setIsIpSetup] = useState(false);
  const [isKarmaSetup, setIsKarmaSetup] = useState(false);
  const [containerPositions, setContainerPositions] = useState<
    Record<string, ContainerPosition>
  >({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [maxContainers] = useState(3);
  const { currentProject: projectData, loading } = useProjectData(id as string);

  useEffect(() => {
    const handleResize = () => {
      // Recalculate positions if needed
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (projectData) {
    }
  }, [projectData]);

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
    const enabledAgents = getEnabledAgents(projectData?.init_state || "");
    const isEnabled = enabledAgents.includes(agentId);

    return (
      !isEnabled ||
      (!activeContainers.includes(agentId) &&
        activeContainers.length >= maxContainers)
    );
  };

  return (
    <>
      <NeonIsometricMaze />
      <div className="absolute w-screen inset-0 min-h-screen">
        <DndProvider backend={HTML5Backend}>
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
                  <AgentComponent
                    userSide={userSide}
                    isSetup={
                      agentId === "socials"
                        ? isSocialSetup
                        : agentId === "ip"
                        ? isIpSetup
                        : agentId === "karma"
                        ? isKarmaSetup
                        : false
                    }
                    setup={() => {
                      if (agentId === "socials") {
                        setIsSocialSetup(true);
                      } else if (agentId == "ip") {
                        setIsIpSetup(true);
                      } else if (agentId == "karma") {
                        setIsKarmaSetup(true);
                      }
                    }}
                  />
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

          {/* Agent Orbs */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 z-20">
            {/* First 3 agents */}
            {agents.slice(0, 3).map((agent) => {
              const isActive = activeContainers.includes(agent.id);

              return (
                <button
                  key={agent.id}
                  onClick={() => handleAgentClick(agent.id)}
                  disabled={isAgentDisabled(agent.id)}
                  className={`relative rounded-full transition-all duration-300 group
                    ${
                      isActive
                        ? userSide === "light"
                          ? "bg-stone-800/90 border-2 border-blue-500 shadow-lg shadow-blue-500/25"
                          : "bg-stone-800/90 border-2 border-red-500 shadow-lg shadow-red-500/25"
                        : isAgentDisabled(agent.id)
                        ? "bg-stone-800/50 border border-stone-700 opacity-50 cursor-not-allowed"
                        : "bg-stone-800/80 border border-stone-600 hover:border-stone-500"
                    }
                    ${
                      getBlinkingAgent(projectData?.init_state || "") ===
                      agent.id
                        ? "animate-pulse"
                        : ""
                    }`}
                >
                  <Image
                    src={`/agents/${userSide}/${agent.id}.png`}
                    alt={agent.name}
                    width={70}
                    height={70}
                    className={`rounded-full
                      ${isAgentDisabled(agent.id) ? "opacity-40 grayscale" : ""}
                      ${
                        isActive
                          ? userSide === "light"
                            ? "ring-2 ring-blue-400 shadow-[0_0_12px_2px_rgba(59,130,246,0.6)]"
                            : "ring-2 ring-red-400 shadow-[0_0_12px_2px_rgba(248,113,113,0.6)]"
                          : ""
                      }
                      ${
                        getBlinkingAgent(projectData?.init_state || "") ===
                        agent.id
                          ? userSide === "light"
                            ? "ring-4 ring-blue-300 shadow-[0_0_20px_4px_rgba(59,130,246,0.8)]"
                            : "ring-4 ring-red-300 shadow-[0_0_20px_4px_rgba(248,113,113,0.8)]"
                          : ""
                      }
                      transition-all
                    `}
                  />
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-stone-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {agent.name}
                  </div>
                </button>
              );
            })}

            {/* Orchestrator (Chat) agent orb, bigger and with more aura */}
            <button
              onClick={() => setIsChatOpen(true)}
              className={`relative rounded-full transition-all duration-300 group
                ${
                  userSide === "light"
                    ? "bg-blue-900/90 border-4 border-blue-400 shadow-[0_0_40px_10px_rgba(59,130,246,0.7)]"
                    : "bg-red-900/90 border-4 border-red-400 shadow-[0_0_40px_10px_rgba(248,113,113,0.7)]"
                }
                mx-6 flex items-center justify-center
              `}
              style={{
                width: 100,
                height: 100,
                minWidth: 100,
                minHeight: 100,
              }}
            >
              <Image
                src={`/agents/${userSide}/orchestrator.png`}
                alt="Orchestrator"
                width={90}
                height={90}
                className={`rounded-full
                  ${
                    userSide === "light"
                      ? "ring-2 ring-blue-400 shadow-[0_0_12px_2px_rgba(59,130,246,0.6)]"
                      : "ring-2 ring-red-400 shadow-[0_0_12px_2px_rgba(248,113,113,0.6)]"
                  }
                  transition-all
                `}
              />
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-stone-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Orchestrator
              </div>
            </button>
            {/* Last 3 agents */}
            {agents.slice(3, 6).map((agent) => {
              const isActive = activeContainers.includes(agent.id);

              return (
                <button
                  key={agent.id}
                  onClick={() => handleAgentClick(agent.id)}
                  disabled={isAgentDisabled(agent.id)}
                  className={`relative rounded-full transition-all duration-300 group
                    ${
                      isActive
                        ? userSide === "light"
                          ? "bg-stone-800/90 border-2 border-blue-500 shadow-lg shadow-blue-500/25"
                          : "bg-stone-800/90 border-2 border-red-500 shadow-lg shadow-red-500/25"
                        : isAgentDisabled(agent.id)
                        ? "bg-stone-800/50 border border-stone-700 opacity-50 cursor-not-allowed"
                        : "bg-stone-800/80 border border-stone-600 hover:border-stone-500"
                    }
                    ${
                      getBlinkingAgent(projectData?.init_state || "") ===
                      agent.id
                        ? "animate-pulse"
                        : ""
                    }`}
                >
                  <Image
                    src={`/agents/${userSide}/${agent.id}.png`}
                    alt={agent.name}
                    width={70}
                    height={70}
                    className={`rounded-full
                      ${isAgentDisabled(agent.id) ? "opacity-40 grayscale" : ""}
                      ${
                        isActive
                          ? userSide === "light"
                            ? "ring-2 ring-blue-400 shadow-[0_0_12px_2px_rgba(59,130,246,0.6)]"
                            : "ring-2 ring-red-400 shadow-[0_0_12px_2px_rgba(248,113,113,0.6)]"
                          : ""
                      }
                      ${
                        getBlinkingAgent(projectData?.init_state || "") ===
                        agent.id
                          ? userSide === "light"
                            ? "ring-4 ring-blue-300 shadow-[0_0_20px_4px_rgba(59,130,246,0.8)]"
                            : "ring-4 ring-red-300 shadow-[0_0_20px_4px_rgba(248,113,113,0.8)]"
                          : ""
                      }
                      transition-all
                    `}
                  />
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-stone-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {agent.name}
                  </div>
                </button>
              );
            })}
          </div>
        </DndProvider>
      </div>
      <div>
        {projectData?.compliance
          ? "Loading compliance..."
          : `${projectData?.compliance.length} compliance records`}
        {projectData?.socials
          ? "Loading socials..."
          : `${projectData?.socials.length} social records`}
        {/* etc */}
      </div>
    </>
  );
}
