"use client";

import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useCardanoWallet } from "@/hooks/use-cardano-wallet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { parseCardanoBalance } from "@/lib/cardano";

export default function WalletButton() {
  const { walletStatus, userSide, connectWallet } = useAppStore();
  const {
    availableWallets,
    connectedWallet,
    address,
    balance,
    connect,
    disconnect,
    isConnected,
  } = useCardanoWallet();

  const handleConnect = async () => {
    if (availableWallets.length > 0) {
      await connect(availableWallets[0]);
      connectWallet();
    }
  };

  const handleDisconnect = () => {
    disconnect();
    connectWallet(); // Reset wallet status in store
  };

  return (
    <div className="flex items-center gap-4">
      {isConnected && (
        <div className="flex items-center gap-2 text-sm">
          <Image src="/cardano.webp" alt="ADA" width={16} height={16} />
          <span className="text-gray-300">
            {parseCardanoBalance(balance ?? "0")} ADA
          </span>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
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
            onClick={!isConnected ? handleConnect : undefined}
            disabled={walletStatus !== "disconnected" && !isConnected}
          >
            <Wallet className="w-4 h-4 mr-2" />
            {!isConnected
              ? walletStatus === "disconnected"
                ? "Connect Wallet"
                : walletStatus === "connecting"
                ? "Connecting..."
                : "Connected"
              : `${address?.slice(0, 6)}...${address?.slice(-4)}`}
          </Button>
        </DropdownMenuTrigger>
        {isConnected && (
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDisconnect}>
              Disconnect Wallet
            </DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </div>
  );
}
