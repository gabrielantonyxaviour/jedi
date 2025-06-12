import Image from "next/image";
import type React from "react";
import { cn } from "@/lib/utils";

interface JediLogoProps {
  className?: string;
  size?: number;
}

const JediLogo: React.FC<JediLogoProps> = ({ className = "", size = 32 }) => {
  return (
    <div className="relative group">
      <div className="absolute -inset-1 rounded-md bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600 animate-[pulse_3s_ease-in-out_infinite] opacity-75 blur-md" />
      <div className="absolute -inset-0.5 rounded-md bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600 animate-[pulse_2s_ease-in-out_infinite] opacity-90" />
      <div className="absolute -inset-0.5 rounded-md bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600 animate-[pulse_2.5s_ease-in-out_infinite] opacity-75 blur-sm" />
      <Image
        src="/logo.jpg"
        alt="Jedi Logo"
        width={size}
        height={size}
        className={cn("relative rounded-md", className)}
      />
    </div>
  );
};
export default JediLogo;
