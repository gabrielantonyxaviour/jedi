"use client";

import type React from "react";
import { useState } from "react";
import NeonIsometricMaze from "../neon-isometric-maze";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Wallet } from "lucide-react";
import JediLogo from "@/components/jedi-logo";
import SideSelection from "@/components/side-selection";
import LogsSheet from "@/components/logs-sheet";
import FalconSheet from "@/components/projects-sheet";

type UserSide = "light" | "dark" | null;
type WalletStatus = "disconnected" | "connecting" | "connected";

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletStatus, setWalletStatus] =
    useState<WalletStatus>("disconnected");
  const [userSide, setUserSide] = useState<UserSide>(null);
  const [showSideSelection, setShowSideSelection] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Add a log entry
  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      message,
      type,
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  // Handle wallet connection
  const connectWallet = async () => {
    setWalletStatus("connecting");

    // Simulate wallet connection
    setTimeout(() => {
      setWalletStatus("connected");
      setShowSideSelection(true);
      addLog("Wallet connected successfully", "success");
    }, 1500);
  };

  // Handle side selection
  const handleSideSelection = (side: "light" | "dark") => {
    setUserSide(side);
    setShowSideSelection(false);
    addLog(`You have chosen the ${side} side`, "info");
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || walletStatus !== "connected") return;

    setIsSubmitting(true);
    addLog(`Processing GitHub URL: ${prompt}`, "info");

    // Simulate processing
    setTimeout(() => {
      setIsSubmitting(false);
      setPrompt("");
      addLog("Repository analysis complete", "success");
    }, 2000);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  // Get accent color based on user's side
  const getAccentColor = () => {
    if (userSide === "light") return "blue";
    if (userSide === "dark") return "red";
    return "gray";
  };

  const accentColor = getAccentColor();

  return (
    <main className="w-full h-screen overflow-hidden bg-black relative">
      <NeonIsometricMaze />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2 p-2">
            <JediLogo size={48} className="rounded-md" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={`text-gray-300 border-gray-700 hover:bg-transparent hover:text-white ${
              walletStatus === "connected"
                ? userSide === "light"
                  ? "border-blue-600 text-blue-400"
                  : userSide === "dark"
                  ? "border-red-600 text-red-400"
                  : ""
                : ""
            }`}
            onClick={connectWallet}
            disabled={walletStatus !== "disconnected"}
          >
            <Wallet className="w-4 h-4 mr-2" />
            {walletStatus === "disconnected"
              ? "Connect Wallet"
              : walletStatus === "connecting"
              ? "Connecting..."
              : "Connected"}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          {showSideSelection ? (
            <SideSelection onSelect={handleSideSelection} />
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-5xl font-bold text-zinc-400 mb-2 font-custom-regular tracking-wide">
                  Build your AI co-founder
                </h1>
                <p
                  className={`text-lg font-medium ${
                    userSide === "light"
                      ? "text-blue-400"
                      : userSide === "dark"
                      ? "text-red-400"
                      : "text-gray-400"
                  }`}
                >
                  {walletStatus !== "connected"
                    ? "Connect your wallet to continue"
                    : userSide === "light"
                    ? "Peace and Knowledge is how we acheive greatness"
                    : "Let's dominate the world with Power and Victory"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="relative">
                <div className="relative">
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      walletStatus !== "connected"
                        ? "Please connect your wallet first"
                        : "Enter your GitHub repository URL"
                    }
                    className={`w-full min-h-[120px] p-4 pr-12 bg-gray-900/50  border-none rounded-xl text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-none focus-visible:ring-[0px] focus:border-transparent backdrop-blur-sm ring-offset-transparent ${
                      userSide === "light"
                        ? "focus:ring-blue-600 focus-visible:ring-blue-600"
                        : userSide === "dark"
                        ? "focus:ring-red-600 focus-visible:ring-red-600"
                        : "focus:ring-white focus-visible:ring-white"
                    }`}
                    disabled={walletStatus !== "connected" || isSubmitting}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      !prompt.trim() ||
                      walletStatus !== "connected" ||
                      isSubmitting
                    }
                    className={`absolute bottom-3 right-3 w-8 h-8 p-0 hover:bg-gray-200 disabled:bg-gray-600 disabled:text-gray-400 rounded-lg ${
                      userSide === "light"
                        ? "bg-blue-600 text-white hover:bg-blue-600"
                        : userSide === "dark"
                        ? "bg-red-600 text-white hover:bg-red-600"
                        : "bg-white text-black"
                    }`}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                </div>
              </form>

              <div className="mt-4 text-center">
                <p className="text-xs text-gray-400">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 text-xs bg-gray-800 rounded">
                    ⌘
                  </kbd>{" "}
                  +{" "}
                  <kbd className="px-1.5 py-0.5 text-xs bg-gray-800 rounded">
                    Enter
                  </kbd>{" "}
                  to send
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Logs button and sheet */}
      {userSide && <LogsSheet logs={logs} side={userSide} />}
      {userSide && <FalconSheet side={userSide} />}

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="p-4 text-center">
          <p className="text-xs text-gray-600">
            Powered by AI • Built for developers
          </p>
        </div>
      </div>
    </main>
  );
}
