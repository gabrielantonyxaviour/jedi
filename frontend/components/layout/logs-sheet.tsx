"use client";

import type React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader,
} from "lucide-react";
import { useState } from "react";
import Image from "next/image";

export interface AgentInteraction {
  interactionId: string;
  projectId: string;
  timestamp: string;

  sourceAgent:
    | "github"
    | "socials"
    | "leads"
    | "compliance"
    | "ip"
    | "karma"
    | "orchestrator"
    | "system";
  targetAgent?:
    | "github"
    | "socials"
    | "leads"
    | "compliance"
    | "ip"
    | "karma"
    | "orchestrator"
    | "system";

  // Interaction details
  type:
    | "task_created"
    | "task_completed"
    | "data_shared"
    | "error"
    | "notification"
    | "workflow_trigger";
  action: string;
  message: string;
  data?: any;

  // Status and context
  status: "pending" | "processing" | "completed" | "failed";
  workflowId?: string;
  taskId?: string;
  parentInteractionId?: string;

  // Metadata
  duration?: number;
  retryCount?: number;
  errorMessage?: string;
}

interface AgentInteractionsSheetProps {
  interactions: AgentInteraction[];
  side: "light" | "dark" | null;
}

const agents = [
  { id: "github", name: "GitHub" },
  { id: "socials", name: "Socials" },
  { id: "leads", name: "Leads" },
  { id: "compliance", name: "Compliance" },
  { id: "ip", name: "IP" },
  { id: "karma", name: "Karma" },
  { id: "orchestrator", name: "Orchestrator" },
];

const getAgentDisplayName = (
  agentId: string,
  side: "light" | "dark" | null
) => {
  const nameMap = {
    light: {
      github: "C-3PO",
      socials: "Ahsoka Tano",
      leads: "Chewbacca",
      compliance: "Princess Leia Organa",
      ip: "Obi-Wan Kenobi",
      karma: "Luke Skywalker",
      orchestrator: "Yoda",
    },
    dark: {
      github: "General Grievous",
      socials: "Savage Opress",
      leads: "Count Dooku",
      compliance: "Darth Maul",
      ip: "Kylo Ren",
      karma: "Darth Vader",
      orchestrator: "Emperor Palpatine",
    },
  };

  if (side && nameMap[side][agentId as keyof typeof nameMap.light]) {
    return nameMap[side][agentId as keyof typeof nameMap.light];
  }
  return agents.find((a) => a.id === agentId)?.name || agentId;
};

const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    case "processing":
      return <Loader className="h-4 w-4 text-yellow-400 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

const getTypeColor = (type: string, side: "light" | "dark" | null) => {
  const colors = {
    light: {
      task_created: "bg-blue-500/20 text-blue-300",
      task_completed: "bg-green-500/20 text-green-300",
      data_shared: "bg-purple-500/20 text-purple-300",
      error: "bg-red-500/20 text-red-300",
      notification: "bg-yellow-500/20 text-yellow-300",
      workflow_trigger: "bg-indigo-500/20 text-indigo-300",
    },
    dark: {
      task_created: "bg-red-500/20 text-red-300",
      task_completed: "bg-green-500/20 text-green-300",
      data_shared: "bg-purple-500/20 text-purple-300",
      error: "bg-red-600/20 text-red-300",
      notification: "bg-orange-500/20 text-orange-300",
      workflow_trigger: "bg-red-700/20 text-red-300",
    },
  };

  return side && colors[side][type as keyof typeof colors.light]
    ? colors[side][type as keyof typeof colors.light]
    : "bg-gray-500/20 text-gray-300";
};

const AgentInteractionsSheet: React.FC<AgentInteractionsSheetProps> = ({
  interactions,
  side,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedInteraction, setSelectedInteraction] =
    useState<AgentInteraction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const formatData = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const filteredInteractions = selectedAgent
    ? interactions.filter(
        (interaction) =>
          interaction.sourceAgent === selectedAgent ||
          interaction.targetAgent === selectedAgent
      )
    : interactions;

  const handleAgentClick = (agentId: string) => {
    setSelectedAgent(selectedAgent === agentId ? null : agentId);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger
          className={`fixed z-50 bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
            side === "light"
              ? "bg-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.8)]"
              : side === "dark"
              ? "bg-red-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.8)]"
              : "bg-zinc-700 hover:shadow-[0_0_30px_rgba(161,161,170,0.8)]"
          }`}
        >
          {side === "light" ? (
            <img
              src="/agents/light/logs.png"
              alt="Light Side"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <img
              src="/agents/dark/logs.png"
              alt="Dark Side"
              className="w-full h-full rounded-full object-cover"
            />
          )}
        </SheetTrigger>
        <SheetContent
          className="w-full sm:max-w-lg bg-zinc-800 border-stone-800 text-white"
          side="right"
        >
          <SheetHeader className="w-full">
            <div className="flex flex-row items-center justify-between">
              <SheetTitle className="text-white font-custom-regular tracking-widest text-xl">
                Agent Interactions
              </SheetTitle>
              <ArrowRight
                className="h-5 w-5 text-stone-400 hover:text-white cursor-pointer"
                onClick={() => setIsOpen(false)}
              />
            </div>
          </SheetHeader>

          {/* Agent Filter Orbs */}
          <div className="flex flex-wrap justify-center gap-3 mt-4 pb-4 border-b border-stone-700">
            {agents.map((agent) => {
              const isActive = selectedAgent === agent.id;
              const isDisabled = selectedAgent && selectedAgent !== agent.id;

              return (
                <button
                  key={agent.id}
                  onClick={() => handleAgentClick(agent.id)}
                  className={`relative rounded-full transition-all duration-300 group
                   ${
                     isActive
                       ? side === "light"
                         ? "bg-stone-800/90 border-2 border-blue-500 shadow-lg shadow-blue-500/25"
                         : "bg-stone-800/90 border-2 border-red-500 shadow-lg shadow-red-500/25"
                       : isDisabled
                       ? "bg-stone-800/50 border border-stone-700 opacity-50"
                       : "bg-stone-800/80 border border-stone-600 hover:border-stone-500"
                   }`}
                >
                  <Image
                    src={`/agents/${side}/${agent.id}.png`}
                    alt={agent.name}
                    width={48}
                    height={48}
                    className={`rounded-full
                     ${isDisabled ? "opacity-40 grayscale" : ""}
                     ${
                       isActive
                         ? side === "light"
                           ? "ring-2 ring-blue-400 shadow-[0_0_12px_2px_rgba(59,130,246,0.6)]"
                           : "ring-2 ring-red-400 shadow-[0_0_12px_2px_rgba(248,113,113,0.6)]"
                         : ""
                     }
                     transition-all
                   `}
                  />
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-stone-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {agent.name}
                  </div>
                </button>
              );
            })}
          </div>

          <ScrollArea className="h-[calc(100vh-220px)] mt-4 pr-4">
            <div className="space-y-4">
              {filteredInteractions.length === 0 ? (
                <p className="text-stone-500 text-center py-8">
                  {selectedAgent
                    ? "No interactions involving this agent"
                    : "No interactions available yet"}
                </p>
              ) : (
                filteredInteractions.map((interaction) => (
                  <div
                    key={interaction.interactionId}
                    className={`border rounded-lg p-4 ${
                      side === "light"
                        ? "border-blue-900/30 bg-blue-950/20"
                        : side === "dark"
                        ? "border-red-900/30 bg-red-950/20"
                        : "border-stone-700 bg-stone-900/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Source Agent Avatar */}
                      <Image
                        src={`/agents/${side}/${interaction.sourceAgent}.png`}
                        alt={getAgentDisplayName(interaction.sourceAgent, side)}
                        width={40}
                        height={40}
                        className="rounded-full flex-shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        {/* Interaction Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white text-sm">
                              {getAgentDisplayName(
                                interaction.sourceAgent,
                                side
                              )}
                            </h4>
                            {interaction.targetAgent && (
                              <>
                                <ArrowRight className="h-3 w-3 text-stone-400" />
                                <span className="text-sm text-stone-300">
                                  {getAgentDisplayName(
                                    interaction.targetAgent,
                                    side
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                          <span className="text-xs text-stone-400">
                            {formatTimeAgo(interaction.timestamp)}
                          </span>
                        </div>

                        {/* Interaction Type and Status */}
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-2 py-1 rounded text-xs ${getTypeColor(
                              interaction.type,
                              side
                            )}`}
                          >
                            {interaction.type.replace("_", " ")}
                          </span>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(interaction.status)}
                            <span className="text-xs text-stone-400">
                              {interaction.status}
                            </span>
                          </div>
                          {interaction.duration && (
                            <span className="text-xs text-stone-400">
                              {interaction.duration}ms
                            </span>
                          )}
                        </div>

                        {/* Action */}
                        <p className="text-sm font-medium text-stone-200 mb-1">
                          {interaction.action}
                        </p>

                        {/* Message */}
                        <p className="text-sm text-stone-300 mb-2 leading-relaxed">
                          {interaction.message}
                        </p>

                        {/* Error Message */}
                        {interaction.errorMessage && (
                          <p className="text-sm text-red-400 mb-2">
                            Error: {interaction.errorMessage}
                          </p>
                        )}

                        {/* Workflow/Task IDs */}
                        {(interaction.workflowId || interaction.taskId) && (
                          <div className="flex gap-2 mb-2">
                            {interaction.workflowId && (
                              <span className="text-xs text-stone-400 bg-stone-800 px-2 py-1 rounded">
                                Workflow: {interaction.workflowId.slice(0, 8)}
                                ...
                              </span>
                            )}
                            {interaction.taskId && (
                              <span className="text-xs text-stone-400 bg-stone-800 px-2 py-1 rounded">
                                Task: {interaction.taskId.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        )}

                        {/* Expand Button */}
                        <div className="flex justify-end">
                          <button
                            className={`p-2 rounded-full transition-colors ${
                              side === "light"
                                ? "hover:bg-blue-900/30 text-blue-400"
                                : side === "dark"
                                ? "hover:bg-red-900/30 text-red-400"
                                : "hover:bg-stone-700 text-stone-400"
                            }`}
                            onClick={() => {
                              setSelectedInteraction(interaction);
                              setIsDialogOpen(true);
                            }}
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-zinc-800 border-stone-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white font-custom-regular tracking-widest">
              Interaction Details
            </DialogTitle>
          </DialogHeader>
          {selectedInteraction && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-stone-400">Source:</span>
                  <span className="ml-2 text-white">
                    {selectedInteraction.sourceAgent}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400">Target:</span>
                  <span className="ml-2 text-white">
                    {selectedInteraction.targetAgent || "System"}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400">Type:</span>
                  <span className="ml-2 text-white">
                    {selectedInteraction.type}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400">Status:</span>
                  <span className="ml-2 text-white">
                    {selectedInteraction.status}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-stone-400 mb-2">Message:</h4>
                <p className="text-white bg-stone-900/50 p-3 rounded">
                  {selectedInteraction.message}
                </p>
              </div>

              {selectedInteraction.data && (
                <div>
                  <h4 className="text-stone-400 mb-2">Data:</h4>
                  <pre className="whitespace-pre-wrap text-sm text-stone-300 bg-stone-900/50 p-4 rounded-lg overflow-auto max-h-[40vh]">
                    {formatData(selectedInteraction.data)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AgentInteractionsSheet;
