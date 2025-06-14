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
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Project, useProjects } from "@/hooks/use-projects";

interface ProjectsSheetProps {
  side: "light" | "dark" | null;
  projects: Array<Project>;
}

const ProjectsSheet: React.FC<ProjectsSheetProps> = ({ side, projects }) => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger className="fixed left-0 top-1/2 -translate-y-1/2">
        <div
          className={`p-2 rounded-md bg-stone-700 border-y-2 border-r-2 rounded-l-none transition-all duration-300 ${
            side === "light"
              ? "border-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.8)]"
              : "border-red-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.8)]"
          }`}
        >
          <Image
            src={
              side === "light" ? "/light-projects.png" : "/dark-projects.png"
            }
            alt="Projects"
            width={48}
            height={48}
            className="w-14 h-14"
          />
        </div>
      </SheetTrigger>
      <SheetContent
        className="w-full sm:max-w-sm bg-stone-800 border-stone-800 text-white"
        side="left"
      >
        <SheetHeader className="w-full">
          <div className="flex flex-row items-center justify-between">
            <ArrowLeft
              className="h-5 w-5 text-stone-400 hover:text-white cursor-pointer"
              onClick={() => {
                setIsOpen(false);
              }}
            />
            <SheetTitle className="text-white font-custom-regular tracking-widest text-xl">
              Projects
            </SheetTitle>
          </div>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-80px)] mt-6 pr-4">
          <div className="space-y-4">
            {projects.length === 0 ? (
              <p className="text-stone-500 text-center py-8">No projects yet</p>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => {
                    console.log("clicked");
                    // TODO: Close the sheet
                  }}
                  className="flex items-center space-x-4 p-3 rounded-lg hover:bg-stone-800/50 transition-colors  cursor-pointer"
                >
                  <div className="relative w-12 h-12 rounded-full overflow-hidden">
                    <Image
                      src={project.imageUrl}
                      alt={project.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <span className="text-stone-200 font-medium">
                    {project.name}
                  </span>
                </div>
              ))
            )}
            <div
              onClick={() => {
                router.push("/");
                setIsOpen(false);
              }}
              className="flex items-center justify-center space-x-3 p-3 cursor-pointer group"
            >
              <Plus className="h-5 w-5 text-stone-500 group-hover:text-white transition-colors" />
              <span className="text-stone-500 font-medium group-hover:text-white transition-colors">
                Create Project
              </span>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default ProjectsSheet;
