"use client";

import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import JediLogo from "@/components/jedi-logo";
import { useAppStore } from "@/store/app-store";

export default function Header() {
  const { walletStatus, userSide, connectWallet } = useAppStore();

  return (
    <div className="absolute top-0 left-0 right-0 z-10">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-2 p-2">
          <JediLogo size={48} className="rounded-md" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={`text-gray-300 border-gray-700 hover:bg-transparent hover:text-white ${
            walletStatus === "connected"
              ? userSide === "light"
                ? "border-blue-600 text-blue-400"
                : userSide === "dark"
                ? "border-red-600 text-red-400"
                : ""
              : ""
          }`}
          onClick={connectWallet}
          disabled={walletStatus !== "disconnected"}
        >
          <Wallet className="w-4 h-4 mr-2" />
          {walletStatus === "disconnected"
            ? "Connect Wallet"
            : walletStatus === "connecting"
            ? "Connecting..."
            : "Connected"}
        </Button>
      </div>
    </div>
  );
}
