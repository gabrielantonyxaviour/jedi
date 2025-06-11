"use client";

import type React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

interface LogsSheetProps {
  logs: LogEntry[];
  side: "light" | "dark" | null;
}

const LogsSheet: React.FC<LogsSheetProps> = ({ logs, side }) => {
  return (
    <Sheet>
      <SheetTrigger
        className={`fixed bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          side === "light"
            ? "bg-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.8)]"
            : side === "dark"
            ? "bg-red-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.8)]"
            : "bg-zinc-700 hover:shadow-[0_0_30px_rgba(161,161,170,0.8)]"
        }`}
      >
        {side === "light" ? (
          <img
            src="/light.png"
            alt="Light Side"
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <img
            src="/dark.png"
            alt="Dark Side"
            className="w-full h-full rounded-full object-cover"
          />
        )}
      </SheetTrigger>
      <SheetContent
        className="w-full sm:max-w-sm bg-zinc-900 border-gray-800 text-white"
        side="right"
      >
        <SheetHeader>
          <SheetTitle className="text-white">Agent Logs</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-80px)] mt-6 pr-4">
          <div className="space-y-4">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No logs available yet
              </p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`border-l-2 pl-4 py-1 ${
                    side === "light"
                      ? "border-blue-600"
                      : side === "dark"
                      ? "border-red-600"
                      : "border-gray-700"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono text-gray-400">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        side === "light"
                          ? "bg-blue-900/30 text-blue-300"
                          : side === "dark"
                          ? "bg-red-900/30 text-red-300"
                          : "bg-zinc-900/30 text-gray-300"
                      }`}
                    >
                      {log.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-300">{log.message}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default LogsSheet;
