"use client";

import { Button } from "@/components/ui/button";
import { LogOut, Wallet } from "lucide-react";
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
  const { walletStatus, userSide, setWalletStatus } = useAppStore();
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
      setWalletStatus("connecting");
      await connect(availableWallets[0]);
      setWalletStatus("connected");
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setWalletStatus("disconnected");
  };

  return (
    <div className="flex items-center gap-4">
      {isConnected && (
        <div className="flex items-center gap-2 text-sm">
          <Image src="/cardano.webp" alt="ADA" width={16} height={16} />
          <span className="text-stone-300">
            {parseCardanoBalance(balance ?? "0")} ADA
          </span>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`text-stone-300 border-stone-700 hover:bg-transparent hover:text-white ${
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
          <DropdownMenuContent
            align="end"
            className="bg-transparent border-none shadow-none hover:bg-transparent  focus:bg-transparent data-[state=open]:bg-transparent hover:text-red-400"
          >
            <DropdownMenuItem
              onClick={handleDisconnect}
              className="bg-transparent border-none shadow-none hover:bg-transparent  focus:bg-transparent data-[state=open]:bg-transparent text-red-400 cursor-pointer hover:text-red-400 focus:text-red-400 data-[state=open]:text-red-400"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </div>
  );
}
