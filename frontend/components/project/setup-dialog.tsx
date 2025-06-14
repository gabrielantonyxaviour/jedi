// components/project-setup-dialog.tsx
"use client";

import { useState } from "react";
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
      "An innovative project that leverages cutting-edge technology to solve real-world problems and create meaningful impact.",
    technicalSummary:
      "Built with modern frameworks and best practices, featuring scalable architecture, robust testing, and comprehensive documentation.",
    image: null,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addLog } = useAppStore();

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

    addLog(
      userSide === "light"
        ? '"Begin your project, you must. Strong with the Force, your vision is. Guide you to success, I will."'
        : '"Good... let your creative ambitions flow through you. Your project shall become more powerful than you can possibly imagine."',
      "orchestrator",
      "info"
    );

    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

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
                setFormData((prev) => ({ ...prev, summary: e.target.value }))
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

          {/* Submit Button */}
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
