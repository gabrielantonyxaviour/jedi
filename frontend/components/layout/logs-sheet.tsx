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
import { ArrowRight, ChevronRight } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: "info" | "success" | "error" | "warning";
  agentId: string;
}

interface LogsSheetProps {
  logs: LogEntry[];
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

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
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

const LogsSheet: React.FC<LogsSheetProps> = ({ logs, side }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const formatMessage = (message: string) => {
    try {
      const parsed = JSON.parse(message);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return message;
    }
  };

  const filteredLogs = selectedAgent
    ? logs.filter((log) => log.agentId === selectedAgent)
    : logs;

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
                Agent Logs
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
              {filteredLogs.length === 0 ? (
                <p className="text-stone-500 text-center py-8">
                  {selectedAgent
                    ? "No logs from this agent"
                    : "No logs available yet"}
                </p>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`border rounded-lg p-4 ${
                      side === "light"
                        ? "border-blue-900/30 bg-blue-950/20"
                        : side === "dark"
                        ? "border-red-900/30 bg-red-950/20"
                        : "border-stone-700 bg-stone-900/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Agent Avatar */}
                      <Image
                        src={`/agents/${side}/${log.agentId}.png`}
                        alt={getAgentDisplayName(log.agentId, side)}
                        width={40}
                        height={40}
                        className="rounded-full flex-shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        {/* Agent Name and Time */}
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-white text-sm">
                            {getAgentDisplayName(log.agentId, side)} (
                            {agents.find((a) => a.id === log.agentId)?.name})
                          </h4>
                          <span className="text-xs text-stone-400">
                            {formatTimeAgo(log.timestamp)}
                          </span>
                        </div>

                        {/* Log Message */}
                        <p className="text-sm text-stone-300 mb-2 leading-relaxed">
                          {log.message}
                        </p>

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
                              setSelectedLog(log);
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
              Log Details
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <pre className="whitespace-pre-wrap text-sm text-stone-300 bg-stone-900/50 p-4 rounded-lg overflow-auto max-h-[60vh]">
              {selectedLog && formatMessage(selectedLog.message)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LogsSheet;
