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
import { useProjects } from "@/hooks/use-projects";
import { useAccount, useSendTransaction } from "wagmi";
import { useBalance } from "wagmi";
import { formatEther, parseEther } from "viem";
import { toast } from "sonner";

interface CreationStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "processing" | "completed" | "error";
  agentName:
    | "github"
    | "socials"
    | "leads"
    | "compliance"
    | "ip"
    | "karma"
    | "orchestrator";
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
    userSide,
    addAgentInteraction,
    setUserSide,
    setProjectId,
    setJobResponse,
  } = useAppStore();

  const { isConnected, address } = useAccount();
  const { data: balance } = useBalance({ address });
  const { data: hash, sendTransactionAsync } = useSendTransaction();

  const {
    projects,
    isLoading: projectsLoading,
    isFetching: isFetching,
  } = useProjects(address || "");

  const initializeSteps = (): CreationStep[] => [
    {
      id: "clone",
      title: "Cloning repository",
      description: "Fetching your GitHub repository",
      status: "pending",
      agentName: "github",
    },
    {
      id: "analyze",
      title: "Analyzing codebase",
      description: "Understanding your project structure",
      status: "pending",
      agentName: "ip",
    },
    {
      id: "agents",
      title: "Initializing agents",
      description: "Setting up specialized AI agents",
      status: "pending",
      agentName: "orchestrator",
    },
    {
      id: "workspace",
      title: "Creating workspace",
      description: "Preparing your project dashboard",
      status: "pending",
      agentName: "orchestrator",
    },
  ];

  // Handle projects loaded - set side from first project
  useEffect(() => {
    if (isFetching && projects.length > 0 && !userSide) {
      const firstProjectSide = projects[0].side;
      setUserSide(firstProjectSide);

      addAgentInteraction({
        sourceAgent: "orchestrator",
        type: "notification",
        action: "User Side Detected",
        message: `User side set to ${firstProjectSide} from existing projects`,
        data: {
          side: firstProjectSide,
          source: "existing_projects",
          projectCount: projects.length,
        },
        status: "completed",
      });
    }
  }, [isFetching, projects, userSide, setUserSide, addAgentInteraction]);

  useEffect(() => {
    console.log("Balance updated in Home component:", balance);
  }, [balance]);

  // Handle side selection for new users
  const handleSideSelection = (side: "light" | "dark") => {
    setUserSide(side);
    setShowSideSelection(false);

    addAgentInteraction({
      sourceAgent: "orchestrator",
      type: "notification",
      action: "Side Selection",
      message: `You have chosen the ${side} side`,
      data: {
        selectedSide: side,
        timestamp: new Date().toISOString(),
        isFirstTime: true,
      },
      status: "completed",
    });
  };

  // Handle project setup completion
  const handleProjectSetup = async (projectData: ProjectSetupData) => {
    addAgentInteraction({
      sourceAgent: "orchestrator",
      type: "task_completed",
      action: "Project Setup Completed",
      message: "Project configuration and setup process completed successfully",
      data: {
        projectName: projectData.name,
        description: projectData.summary || "",
        technicalSummary: projectData.technicalSummary || "",
        setupDuration: Date.now(), // You might want to track actual duration
      },
      status: "completed",
    });

    // Here you would typically save the project to your backend
    console.log("Project data:", projectData);

    setShowProjectSetup(false);

    // Navigate to project page after a brief delay
    setTimeout(() => {
      router.push("/project/sample-project");
    }, 500);
  };

  useEffect(() => {
    if (hash) {
      toast.success("Transaction sent", {
        description: "Payment to orchestrator confirmed!",
        action: {
          label: "View on Explorer",
          onClick: () => {
            window.open(
              `https://explorer.mainnet.aurora.dev/tx/${hash}`,
              "_blank"
            );
          },
        },
      });

      addAgentInteraction({
        sourceAgent: "orchestrator",
        type: "notification",
        action: "Payment Confirmed",
        message: "Transaction successfully sent to orchestrator",
        data: {
          transactionHash: hash,
          amount: "0.000005 ETH",
          network: "Aurora",
        },
        status: "completed",
      });
    }
  }, [hash, addAgentInteraction]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !isConnected) return;

    // if (!(await isPublicRepo(prompt))) {
    //   setError("Please make sure the repository is public");
    //   return;
    // }

    if (parseFloat(formatEther(balance?.value ?? BigInt("0"))) < 0.000005) {
      setError(
        "Please top up your wallet with at least 0.000005 ETH in Aurora to continue"
      );
      return;
    }

    try {
      // TODO: Send Transaction to x04 service
      // TODO: Send api call to agent to create project
    } catch (error) {
      addAgentInteraction({
        sourceAgent: "orchestrator",
        type: "error",
        action: "Payment Failed",
        message: "Failed to send payment transaction",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        status: "failed",
      });
      return;
    }

    setError("");
    setGithubUrl(prompt);
    setIsSubmitting(true);
    setIsCreating(true);

    const steps = initializeSteps();
    setCreationSteps(steps);
    setCurrentStepIndex(-1);

    addAgentInteraction({
      sourceAgent: "github",
      type: "task_created",
      action: "Repository Processing Started",
      message: `Processing GitHub URL: ${prompt}`,
      data: {
        repositoryUrl: prompt,
        startTime: new Date().toISOString(),
      },
      status: "processing",
    });

    // Process steps one by one
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setCurrentStepIndex(i);

      setCreationSteps((prev) =>
        prev.map((s, index) =>
          index === i ? { ...s, status: "processing" } : s
        )
      );

      // Log step start
      addAgentInteraction({
        sourceAgent: step.agentName,
        type: "task_created",
        action: step.title,
        message: `Started: ${step.description}`,
        data: { stepIndex: i, stepId: step.id },
        status: "processing",
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      setCreationSteps((prev) =>
        prev.map((s, index) =>
          index === i ? { ...s, status: "completed" } : s
        )
      );

      // Log step completion
      addAgentInteraction({
        sourceAgent: step.agentName,
        type: "task_completed",
        action: step.title,
        message: `Completed: ${step.description}`,
        data: {
          stepIndex: i,
          stepId: step.id,
          duration: 2000, // Since we're using a fixed delay
        },
        status: "completed",
        duration: 2000,
      });
    }

    // Log overall completion
    addAgentInteraction({
      sourceAgent: "orchestrator",
      type: "workflow_trigger",
      action: "Project Creation Completed",
      message: "All initialization steps completed successfully",
      data: {
        repositoryUrl: prompt,
        stepsCompleted: steps.length,
        totalDuration: steps.length * 2000,
      },
      status: "completed",
    });

    // Show project setup dialog instead of navigating directly
    setIsCreating(false);
    setIsSubmitting(false);
    setShowProjectSetup(true);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  // Show loading while fetching projects after wallet connection
  const shouldShowLoading = (isConnected && isFetching) || showProjectSetup;

  // Show side selection only for new users (no existing projects)
  const shouldShowSideSelection =
    isConnected &&
    !isFetching &&
    projects.length === 0 &&
    userSide === null &&
    !showProjectSetup;

  // Show main UI when everything is ready
  const shouldShowMainUI =
    isConnected &&
    !isFetching &&
    !projectsLoading &&
    (projects.length > 0 || userSide !== null) &&
    !showProjectSetup;

  useEffect(() => {
    console.log("state logs", {
      shouldShowLoading,
      shouldShowSideSelection,
      shouldShowMainUI,
      projectsLoading,
      isConnected,
      isFetching,
      projects,
      userSide,
      showProjectSetup,
    });
  }, [
    shouldShowLoading,
    shouldShowSideSelection,
    shouldShowMainUI,
    projectsLoading,
    isFetching,
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
          ) : shouldShowMainUI || !isConnected ? (
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
                  {!isConnected
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
                      !isConnected
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
                    disabled={!isConnected || isSubmitting}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!prompt.trim() || !isConnected || isSubmitting}
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
    </>
  );
}
