"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import NeonIsometricMaze from "@/components/neon-isometric-maze";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp } from "lucide-react";
import SideSelection from "@/components/side-selection";
import { useAppStore } from "@/store/app-store";
import { motion } from "framer-motion";

interface CreationStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "processing" | "completed" | "error";
}

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSideSelection, setShowSideSelection] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creationSteps, setCreationSteps] = useState<CreationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const { walletStatus, userSide, addLog, setUserSide } = useAppStore();

  const initializeSteps = (): CreationStep[] => [
    {
      id: "wallet",
      title: "Checking wallet balance",
      description: "Verifying sufficient funds for agent operations",
      status: "pending",
    },
    {
      id: "topup",
      title: "Topping up agent wallet",
      description: "Transferring funds to Masumi agent",
      status: "pending",
    },
    {
      id: "clone",
      title: "Cloning repository",
      description: "Fetching your GitHub repository",
      status: "pending",
    },
    {
      id: "analyze",
      title: "Analyzing codebase",
      description: "Understanding your project structure",
      status: "pending",
    },
    {
      id: "agents",
      title: "Initializing agents",
      description: "Setting up specialized AI agents",
      status: "pending",
    },
    {
      id: "workspace",
      title: "Creating workspace",
      description: "Preparing your project dashboard",
      status: "pending",
    },
  ];

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
    setIsCreating(true);

    const steps = initializeSteps();
    setCreationSteps(steps);
    setCurrentStepIndex(-1);

    addLog(`Processing GitHub URL: ${prompt}`, "info");

    // Process steps one by one
    for (let i = 0; i < steps.length; i++) {
      setCurrentStepIndex(i);
      await new Promise((resolve) => setTimeout(resolve, 500));

      setCreationSteps((prev) =>
        prev.map((step, index) =>
          index === i ? { ...step, status: "processing" } : step
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      setCreationSteps((prev) =>
        prev.map((step, index) =>
          index === i ? { ...step, status: "completed" } : step
        )
      );

      addLog(steps[i].title + " completed", "success");
    }

    // Navigate to project page
    setTimeout(() => {
      router.push("/project/sample-project");
    }, 1000);
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
        <div className="w-full max-w-3xl flex flex-col items-center">
          {walletStatus == "connected" && userSide == null ? (
            <SideSelection onSelect={handleSideSelection} />
          ) : (
            <div className="flex flex-col items-center w-full">
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
                      : "text-stone-400"
                  }`}
                >
                  {walletStatus !== "connected"
                    ? "Connect your wallet to continue"
                    : userSide === "light"
                    ? "Peace and Knowledge is how we achieve greatness"
                    : "Let's dominate the world with Power and Victory"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="relative mb-8 w-full">
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
                    className={`w-full min-h-[120px] p-4 pr-12 bg-zinc-800/40 border-none rounded-xl text-white placeholder-stone-600 resize-none focus:outline-none focus:ring-none focus-visible:ring-[0px] focus:border-transparent backdrop-blur-sm ring-offset-transparent ${
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
                    className={`absolute bottom-3 right-3 w-8 h-8 p-0 hover:bg-stone-200 disabled:bg-stone-600 disabled:text-stone-400 rounded-lg ${
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

              {/* Creation Steps - Show one by one */}
              {isCreating && (
                <div className="space-y-3 w-full max-w-2xl overflow-y-auto max-h-[40vh] pr-2 fixed bottom-8">
                  {creationSteps.map((step, index) => {
                    // Only show current step and completed steps
                    if (index > currentStepIndex) return null;

                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`p-4 rounded-lg border backdrop-blur-sm ${
                          step.status === "completed"
                            ? userSide === "light"
                              ? "bg-blue-900/20 border-blue-600"
                              : "bg-red-900/20 border-red-600"
                            : step.status === "processing"
                            ? "bg-yellow-900/20 border-yellow-600"
                            : "bg-stone-900/20 border-stone-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                step.status === "completed"
                                  ? userSide === "light"
                                    ? "bg-blue-500"
                                    : "bg-red-500"
                                  : step.status === "processing"
                                  ? "bg-yellow-500 animate-pulse"
                                  : "bg-stone-500"
                              }`}
                            />
                            <div>
                              <h3 className="font-medium text-white text-sm">
                                {step.title}
                              </h3>
                              <p className="text-xs text-stone-400">
                                {step.description}
                              </p>
                            </div>
                          </div>

                          {step.status === "processing" && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
