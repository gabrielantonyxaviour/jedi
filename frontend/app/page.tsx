// Updated Home component
"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NeonIsometricMaze from "@/components/neon-isometric-maze";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp } from "lucide-react";
import SideSelection from "@/components/side-selection";
import ProjectSetupDialog, {
  ProjectSetupData,
} from "@/components/project/setup-dialog";
import { useAppStore } from "@/store/app-store";
import { motion } from "framer-motion";
// import { isPublicRepo } from "@/lib/github/check-public";
import { parseCardanoBalance } from "@/lib/cardano";
import { useProjects } from "@/hooks/use-projects";
import TransferDialog from "@/components/transfer-dialog";

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
  const [showProjectSetup, setShowProjectSetup] = useState(false);
  const [creationSteps, setCreationSteps] = useState<CreationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [error, setError] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const {
    walletStatus,
    userSide,
    addLog,
    setUserSide,
    balance,
    setProjectId,
    address,
    setJobResponse,
  } = useAppStore();
  const {
    projects,
    loading: projectsLoading,
    initialized,
  } = useProjects(address || "");

  const initializeSteps = (): CreationStep[] => [
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

  // Handle projects loaded - set side from first project
  useEffect(() => {
    if (initialized && projects.length > 0 && !userSide) {
      const firstProjectSide = projects[0].side;
      setUserSide(firstProjectSide);
      addLog(
        `User side set to ${firstProjectSide} from existing projects`,
        "orchestrator",
        "info"
      );
    }
  }, [initialized, projects, userSide, setUserSide, addLog]);

  useEffect(() => {
    console.log("Balance updated in Home component:", balance);
  }, [balance]);

  // Handle side selection for new users
  const handleSideSelection = (side: "light" | "dark") => {
    setUserSide(side);
    setShowSideSelection(false);
    addLog(`You have chosen the ${side} side`, "orchestrator", "info");
  };

  // Handle project setup completion
  const handleProjectSetup = async (projectData: ProjectSetupData) => {
    addLog("Project setup completed", "orchestrator", "success");

    // Here you would typically save the project to your backend
    console.log("Project data:", projectData);

    setShowProjectSetup(false);

    // Navigate to project page after a brief delay
    setTimeout(() => {
      router.push("/project/sample-project");
    }, 500);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || walletStatus !== "connected") return;

    // if (!(await isPublicRepo(prompt))) {
    //   setError("Please make sure the repository is public");
    //   return;
    // }

    if (parseFloat(parseCardanoBalance(balance)) < 10) {
      setError("Please top up your wallet with at least 10 ADA");
      return;
    }

    setError("");

    addLog(`Creating a Masumi Job: ${prompt}`, "orchestrator", "info");
    try {
      const response = await fetch("/api/start_job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier_from_purchaser: address.slice(0, 15),
          input_data: {
            text: prompt,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start job");
      }

      const data = await response.json();
      setJobResponse(data);
      addLog("Job started successfully", "orchestrator", "success");
    } catch (error) {
      console.error("Error starting job:", error);
      addLog("Failed to start job", "orchestrator", "error");
    }
    setShowTransferDialog(true);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  // Show loading while fetching projects after wallet connection
  const shouldShowLoading =
    (walletStatus === "connected" && !initialized) || showProjectSetup; // Keep loading while project setup is open

  // Show side selection only for new users (no existing projects)
  const shouldShowSideSelection =
    walletStatus === "connected" &&
    initialized &&
    projects.length === 0 &&
    userSide === null &&
    !showProjectSetup;

  // Show main UI when everything is ready
  const shouldShowMainUI =
    walletStatus === "connected" &&
    initialized &&
    !projectsLoading &&
    (projects.length > 0 || userSide !== null) &&
    !showProjectSetup;

  useEffect(() => {
    const shouldShowLoading =
      (walletStatus === "connected" && !initialized) || showProjectSetup; // Keep loading while project setup is open

    // Show side selection only for new users (no existing projects)
    const shouldShowSideSelection =
      walletStatus === "connected" &&
      initialized &&
      projects.length === 0 &&
      userSide === null &&
      !showProjectSetup;

    // Show main UI when everything is ready
    const shouldShowMainUI =
      walletStatus === "connected" &&
      initialized &&
      !projectsLoading &&
      (projects.length > 0 || userSide !== null) &&
      !showProjectSetup;

    console.log("state logs");
    console.log({
      shouldShowLoading,
      shouldShowSideSelection,
      shouldShowMainUI,
      projectsLoading,
      walletStatus,
      initialized,
      projects,
      userSide,
      showProjectSetup,
    });
  }, [
    projectsLoading,
    walletStatus,
    initialized,
    projects,
    userSide,
    showProjectSetup,
  ]);

  return (
    <>
      <NeonIsometricMaze />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl flex flex-col items-center">
          {shouldShowLoading ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
              <p className="text-stone-400">
                {showProjectSetup
                  ? "Setting up your project..."
                  : "Loading your projects..."}
              </p>
            </div>
          ) : shouldShowSideSelection ? (
            <SideSelection onSelect={handleSideSelection} />
          ) : shouldShowMainUI || walletStatus !== "connected" ? (
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
                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
              </form>

              {/* Creation Steps - Show one by one */}
              {isCreating && (
                <div className="space-y-3 w-full max-w-2xl overflow-y-auto max-h-[30vh] pr-2 fixed bottom-8">
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
                            : "bg-stone-800/20 border-stone-700"
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
          ) : null}
        </div>
      </div>

      {/* Project Setup Dialog */}
      <ProjectSetupDialog
        open={showProjectSetup}
        onSubmit={handleProjectSetup}
        userSide={userSide!}
        githubUrl={githubUrl}
      />

      {showTransferDialog && (
        <TransferDialog
          open={showTransferDialog}
          onClose={async () => {
            setShowTransferDialog(false);

            setGithubUrl(prompt);
            setIsSubmitting(true);
            setIsCreating(true);

            const steps = initializeSteps();
            setCreationSteps(steps);
            setCurrentStepIndex(-1);

            addLog(`Processing GitHub URL: ${prompt}`, "github", "info");

            // Process steps one by one
            for (let i = 0; i < steps.length; i++) {
              setCurrentStepIndex(i);

              setCreationSteps((prev) =>
                prev.map((step, index) =>
                  index === i ? { ...step, status: "processing" } : step
                )
              );

              try {
                const response = await fetch("/api/agent/create-project", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    repoUrl: prompt,
                    walletAddress: address,
                    side: userSide,
                  }),
                });

                if (!response.ok) {
                  throw new Error("Failed to create project");
                }

                const data = await response.json();
                addLog(
                  `Project created successfully: ${data.projectId}`,
                  "orchestrator",
                  "success"
                );
                setProjectId(data.projectId);
              } catch (error) {
                console.error("Error creating project:", error);
                addLog("Failed to create project", "orchestrator", "error");
                throw error;
              }
              setCreationSteps((prev) =>
                prev.map((step, index) =>
                  index === i ? { ...step, status: "completed" } : step
                )
              );

              addLog(steps[i].title + " completed", "orchestrator", "success");
            }

            // Show project setup dialog instead of navigating directly
            setIsCreating(false);
            setIsSubmitting(false);
            setShowProjectSetup(true);
          }}
        />
      )}
    </>
  );
}
