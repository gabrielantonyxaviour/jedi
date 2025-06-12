"use client";

import type React from "react";
import { useState } from "react";
import NeonIsometricMaze from "../neon-isometric-maze";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp } from "lucide-react";
import SideSelection from "@/components/side-selection";
import { useAppStore } from "@/store/app-store";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSideSelection, setShowSideSelection] = useState(false);
  const { walletStatus, userSide, addLog, setUserSide } = useAppStore();

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

  return (
    <>
      <NeonIsometricMaze />
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
                    className={`w-full min-h-[120px] p-4 pr-12 bg-zinc-800/40  border-none rounded-xl text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-none focus-visible:ring-[0px] focus:border-transparent backdrop-blur-sm ring-offset-transparent ${
                      userSide === "light"
                        ? "focus:ring-blue-500 focus-visible:ring-blue-500"
                        : userSide === "dark"
                        ? "focus:ring-red-500 focus-visible:ring-red-500"
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
            </>
          )}
        </div>
      </div>
    </>
  );
}
