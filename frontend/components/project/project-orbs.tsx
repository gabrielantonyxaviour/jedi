"use client";

import { motion } from "framer-motion";
import {
  Github,
  Users,
  Target,
  Shield,
  FileText,
  Heart,
  MessageSquare,
} from "lucide-react";

interface ProjectOrbsProps {
  onOrbClick: (orbId: string) => void;
  onChatClick: () => void;
  activeContainers: string[];
  userSide: "light" | "dark" | null;
}

const orbs = [
  { id: "github", icon: Github, label: "GitHub Intelligence" },
  { id: "socials", icon: Users, label: "Socials Agent" },
  { id: "leads", icon: Target, label: "Leads Agent" },
  { id: "ip", icon: Shield, label: "IP Agent" },
  { id: "compliance", icon: FileText, label: "Compliance Agent" },
  { id: "karma", icon: Heart, label: "Karma Agent" },
];

export default function ProjectOrbs({
  onOrbClick,
  onChatClick,
  activeContainers,
  userSide,
}: ProjectOrbsProps) {
  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-20">
      <div className="flex items-center space-x-4">
        {/* Agent orbs */}
        {orbs.map((orb, index) => (
          <motion.button
            key={orb.id}
            onClick={() => onOrbClick(orb.id)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
              activeContainers.includes(orb.id)
                ? userSide === "light"
                  ? "bg-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                  : "bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.6)]"
                : "bg-gray-800 hover:bg-gray-700"
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <orb.icon className="w-6 h-6 text-white" />
          </motion.button>
        ))}

        {/* Central chat orb */}
        <motion.button
          onClick={onChatClick}
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-4 ${
            userSide === "light"
              ? "bg-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.8)]"
              : "bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.8)]"
          }`}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
        >
          <MessageSquare className="w-8 h-8 text-white" />
        </motion.button>
      </div>
    </div>
  );
}
