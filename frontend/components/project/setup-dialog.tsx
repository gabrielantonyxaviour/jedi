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

    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    onSubmit(formData);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="bg-zinc-900 border-zinc-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            Setup Your Project
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label className="text-white">Project Image</Label>
            <div className="border-2 border-dashed border-zinc-600 rounded-lg p-6 text-center">
              {imagePreview ? (
                <div className="relative">
                  <Image
                    src={imagePreview}
                    alt="Project preview"
                    width={200}
                    height={120}
                    className="mx-auto rounded-lg object-cover"
                  />
                  <Button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 w-6 h-6 p-0 bg-red-600 hover:bg-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
                  <Label htmlFor="image-upload" className="cursor-pointer">
                    <span className="text-blue-400 hover:text-blue-300">
                      Click to upload project image
                    </span>
                    <p className="text-sm text-zinc-500 mt-1">
                      PNG, JPG up to 10MB
                    </p>
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
              className="bg-zinc-800 border-zinc-600 text-white"
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
              className="bg-zinc-800 border-zinc-600 text-white min-h-[100px]"
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
              className="bg-zinc-800 border-zinc-600 text-white min-h-[100px]"
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
