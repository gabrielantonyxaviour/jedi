// components/project-setup-dialog.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import Image from "next/image";
import { Badge } from "../ui/badge";
import { useAppStore } from "@/store/app-store";
import { useProjects } from "@/hooks/use-projects";
import { useAccount } from "wagmi";

interface ProjectSetupDialogProps {
  open: boolean;
  onSubmit: (data: ProjectSetupData) => void;
  userSide: "light" | "dark";
  githubUrl: string;
}

export interface ProjectSetupData {
  name: string;
  summary: string;
  technicalSummary: string;
  image: File | null;
}

export default function ProjectSetupDialog({
  open,
  onSubmit,
  userSide,
  githubUrl,
}: ProjectSetupDialogProps) {
  const [formData, setFormData] = useState<ProjectSetupData>({
    name: extractRepoName(githubUrl),
    summary:
      "Early-stage TypeScript chat application with agent servers and interactive dialogs. Single contributor actively developing core chat functionalities.",
    technicalSummary:
      "The Jedi AI Framework implements a TypeScript-based distributed chat system using an agent server architecture where multiple server instances coordinate to handle chat requests and manage real-time communication flows. The 5841 KB codebase suggests a substantial implementation with strongly-typed message contracts, event-driven processing, and a real-time UI component ('mp chat dialog') that likely leverages WebSocket connections for bidirectional communication. The architecture appears to follow a microservices pattern with agent servers acting as specialized message processors, enabling horizontal scaling and load distribution across instances, while the TypeScript foundation provides compile-time safety for message schemas and inter-service communication protocols.",
    image: null,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addAgentInteraction, projectId } = useAppStore();
  const { address } = useAccount();
  const { projects, isLoading, error, fetchProjectById } = useProjects(address);
  const [formInitialized, setFormInitialized] = useState(false);
  const [showTechnicalSummary, setShowTechnicalSummary] = useState(false);

  useEffect(() => {
    (async () => {
      if (imagePreview) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        setShowTechnicalSummary(true);
      }
    })();
  }, [imagePreview]);

  // useEffect(() => {
  //   if (!currentProject) return;
  //   console.log("currentProject");
  //   console.log(currentProject);
  //   if (!formInitialized && currentProject?.init_state === "GITHUB") {
  //     setFormData({
  //       name: projectData.name || "",
  //       summary: projectData.summary || "",
  //       technicalSummary: projectData.technicalSummary || "",
  //       image: null,
  //     });
  //     setFormInitialized(true);
  //   }
  // }, [formInitialized, projectData]);

  function extractRepoName(url: string): string {
    try {
      const parts = url.split("/");
      return parts[parts.length - 1] || "My Project";
    } catch {
      return "My Project";
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image: null }));
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    addAgentInteraction({
      sourceAgent: "orchestrator",
      type: "notification",
      action: "Project Setup Started",
      message:
        userSide === "light"
          ? '"Begin your project, you must. Strong with the Force, your vision is. Guide you to success, I will."'
          : '"Good... let your creative ambitions flow through you. Your project shall become more powerful than you can possibly imagine."',
      data: { userSide, githubUrl },
      status: "completed",
    });

    let imageUri = "test";
    if (formData.image) {
      try {
        const uploadFormData = new FormData();
        uploadFormData.append("file", formData.image);

        const uploadResponse = await fetch("/api/ipfs/upload-file", {
          method: "POST",
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image");
        }

        const { ipfsUri } = await uploadResponse.json();
        imageUri = ipfsUri;
      } catch (error) {
        console.error("Error uploading image:", error);
        addAgentInteraction({
          sourceAgent: "orchestrator",
          type: "error",
          action: "Image Upload Failed",
          message: "Failed to upload project image to IPFS",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          status: "failed",
        });
        setIsSubmitting(false);
        return;
      }
    }

    // try {
    //   const response = await fetch("/api/agent/setup-project", {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({
    //       projectId,
    //       name: formData.name,
    //       description: formData.summary,
    //       technicalDescription: formData.technicalSummary,
    //       imageUrl: imageUri,
    //     }),
    //   });

    //   if (!response.ok) {
    //     throw new Error("Failed to setup project");
    //   }

    //   const data = await response.json();
    //   addAgentInteraction({
    //     sourceAgent: 'orchestrator',
    //     type: 'notification',
    //     action: 'Project Setup Completed',
    //     message: 'Project configuration and setup process completed successfully',
    //     data: { projectName: formData.name, description: formData.summary, technicalSummary: formData.technicalSummary },
    //     status: 'completed'
    //   });
    // } catch (error) {
    //   console.error("Error setting up project:", error);
    //   addAgentInteraction({
    //     sourceAgent: 'orchestrator',
    //     type: 'error',
    //     action: 'Project Setup Failed',
    //     message: 'Failed to setup project',
    //     errorMessage: error instanceof Error ? error.message : 'Unknown error',
    //     status: 'failed'
    //   });
    //   setIsSubmitting(false);
    //   return;
    // }

    onSubmit(formData);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="bg-stone-900 border-stone-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            Setup Your Project
          </DialogTitle>
        </DialogHeader>
        <div
          className={`bg-stone-800/50 rounded-lg p-4 mb-6 border-l-4 ${
            userSide === "light" ? "border-blue-500" : "border-red-500"
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-stone-600">
              <Image
                src={`/agents/${userSide}/orchestrator.png`}
                alt="Orchestrator Agent"
                fill
                className="object-cover"
              />
            </div>
            <p className="text-white text-md font-bold">
              {userSide === "light" ? "Yoda" : "Emperor Palpatine"}
            </p>
            <Badge
              variant="secondary"
              className={`${
                userSide === "light"
                  ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                  : "bg-red-600/20 text-red-400 border-red-500/30"
              }`}
            >
              Orchestrator Agent
            </Badge>
          </div>
          <p className="text-stone-300 italic text-sm leading-relaxed">
            {userSide === "light"
              ? '"Begin your project, you must. Strong with the Force, your vision is. Guide you to success, I will."'
              : '"Good... let your creative ambitions flow through you. Your project shall become more powerful than you can possibly imagine."'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label className="text-white">Project Image</Label>
            <div className="border-2 border-dashed border-stone-600 rounded-lg p-6 text-center">
              {imagePreview ? (
                <div className="flex justify-center">
                  <div className="relative w-32 h-32">
                    <Image
                      src={imagePreview}
                      alt="Project preview"
                      fill
                      className="rounded-full object-cover border-4 border-stone-600"
                    />
                    <Button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 w-6 h-6 p-0 bg-red-600 hover:bg-red-700 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Label
                    htmlFor="image-upload"
                    className="cursor-pointer group"
                  >
                    <div className="w-32 h-32 mb-3 border-2 border-dashed border-stone-600 rounded-full flex items-center justify-center group-hover:border-stone-500 transition-colors">
                      <Upload className="w-8 h-8 text-stone-400 group-hover:text-stone-300" />
                    </div>
                    <div className="text-center">
                      <span
                        className={`${
                          userSide === "light"
                            ? "text-blue-400 hover:text-blue-300"
                            : "text-red-400 hover:text-red-300"
                        } text-sm`}
                      >
                        Upload project logo
                      </span>
                      <p className="text-xs text-stone-500 mt-1">
                        PNG, JPG up to 10MB
                      </p>
                    </div>
                  </Label>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </div>

          {showTechnicalSummary ? (
            <>
              {/* Project Name */}
              <div className="space-y-2">
                <Label className="text-white">Project Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="bg-stone-800 border-stone-600 text-white"
                  required
                />
              </div>

              {/* Summary */}
              <div className="space-y-2">
                <Label className="text-white">Project Summary</Label>
                <Textarea
                  value={formData.summary}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      summary: e.target.value,
                    }))
                  }
                  className="bg-stone-800 border-stone-600 text-white min-h-[100px]"
                  placeholder="Describe what your project does..."
                  required
                />
              </div>

              {/* Technical Summary */}
              <div className="space-y-2">
                <Label className="text-white">Technical Summary</Label>
                <Textarea
                  value={formData.technicalSummary}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      technicalSummary: e.target.value,
                    }))
                  }
                  className="bg-stone-800 border-stone-600 text-white min-h-[100px]"
                  placeholder="Describe the technical aspects..."
                  required
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-8 ${
                    userSide === "light"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-red-600 hover:bg-red-700"
                  } text-white`}
                >
                  {isSubmitting ? "Creating Project..." : "Create Project"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative w-16 h-16">
                <Image
                  src={`/agents/${userSide}/github.png`}
                  alt="Orchestrator Agent"
                  fill
                  className="object-cover animate-pulse"
                />
              </div>
              <p className="text-stone-300 text-center">
                {userSide === "light"
                  ? "Analyzing your project, I am..."
                  : "Your project's potential is being assessed..."}
              </p>
              <div className="w-full max-w-md h-2 bg-stone-800 rounded-full overflow-hidden">
                <div className="h-full bg-stone-600 animate-[loading_2s_ease-in-out_infinite]" />
              </div>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
