"use client";

import type React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

interface SideSelectionProps {
  onSelect: (side: "light" | "dark") => void;
}

const SideSelection: React.FC<SideSelectionProps> = ({ onSelect }) => {
  return (
    <div className="flex flex-col items-center space-y-8">
      <h2 className="text-3xl text-zinc-400 font-bold font-custom-regular tracking-widest">
        Choose Your Path
      </h2>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Light Side Card */}
        <motion.div
          whileHover={{
            scale: 1.05,
            boxShadow: "0 0 15px rgba(59, 130, 246, 0.5)",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className="w-full md:w-64"
        >
          <Card
            className="border border-stone-700 bg-stone-900/50 backdrop-blur-sm overflow-hidden cursor-pointer h-80"
            onClick={() => onSelect("light")}
          >
            <CardContent className="p-0 h-full flex flex-col">
              <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
                {/* Placeholder for Obi-Wan image */}
                <div className="w-32 h-32 rounded-full bg-stone-800 flex items-center justify-center">
                  <span className="text-blue-500 text-4xl">光</span>
                </div>

                {/* Light side glow effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent opacity-50" />
              </div>

              <div className="p-6 text-center border-t border-stone-700 bg-stone-800/50">
                <h3 className="text-xl font-bold text-blue-400">Light Side</h3>
                <p className="text-stone-400 mt-1">
                  Peace, Knowledge, Serenity
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Dark Side Card */}
        <motion.div
          whileHover={{
            scale: 1.05,
            boxShadow: "0 0 15px rgba(239, 68, 68, 0.5)",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className="w-full md:w-64"
        >
          <Card
            className="border border-stone-700 bg-stone-900/50 backdrop-blur-sm overflow-hidden cursor-pointer h-80"
            onClick={() => onSelect("dark")}
          >
            <CardContent className="p-0 h-full flex flex-col">
              <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
                {/* Placeholder for Darth Vader image */}
                <div className="w-32 h-32 rounded-full bg-stone-800 flex items-center justify-center">
                  <span className="text-red-500 text-4xl">闇</span>
                </div>

                {/* Dark side glow effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-red-500/10 to-transparent opacity-50" />
              </div>

              <div className="p-6 text-center border-t border-stone-700 bg-stone-800/50">
                <h3 className="text-xl font-bold text-red-400">Dark Side</h3>
                <p className="text-stone-400 mt-1">Power, Passion, Strength</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default SideSelection;
