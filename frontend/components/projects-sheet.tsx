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

interface FalconSheetProps {
  side: "light" | "dark" | null;
}

const FalconSheet: React.FC<FalconSheetProps> = ({ side }) => {
  return (
    <Sheet>
      <SheetTrigger className="fixed left-0 top-1/2 -translate-y-1/2">
        <div
          className={`p-2 rounded-md bg-zinc-700 border-y-2 border-r-2 rounded-l-none transition-all duration-300 ${
            side === "light"
              ? "border-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.8)]"
              : "border-red-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.8)]"
          }`}
        >
          <Image
            src={
              side === "light" ? "/light-projects.png" : "/dark-projects.png"
            }
            alt="Millennium Falcon"
            width={48}
            height={48}
            className="w-14 h-14"
          />
        </div>
      </SheetTrigger>
      <SheetContent
        className="w-full sm:max-w-sm bg-zinc-900 border-gray-800 text-white"
        side="left"
      >
        <SheetHeader>
          <SheetTitle className="text-white">Millennium Falcon</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-80px)] mt-6 pr-4">
          <div className="space-y-4">
            <div className="text-gray-300">
              <h3 className="text-lg font-semibold mb-2">
                Ship Specifications
              </h3>
              <ul className="space-y-2">
                <li>Class: YT-1300 light freighter</li>
                <li>Length: 34.75 meters</li>
                <li>Max Speed: 1,050 km/h</li>
                <li>Hyperdrive: Class 0.5</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default FalconSheet;
