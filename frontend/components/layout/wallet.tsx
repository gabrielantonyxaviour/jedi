"use client";

import { Button } from "@/components/ui/button";
import { LogOut, Wallet } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { parseCardanoBalance } from "@/lib/cardano";
import { useConnectModal } from "@tomo-inc/tomo-evm-kit";
import { formatEther } from "viem";
import { useAccount, useBalance, useDisconnect } from "wagmi";

export default function WalletButton() {
  const { openConnectModal } = useConnectModal();
  const { userSide } = useAppStore();
  const { isConnected, address } = useAccount();
  const { data: balance } = useBalance({ address });
  const { disconnect } = useDisconnect();

  return (
    <div className="flex items-center gap-4">
      {isConnected && (
        <div className="flex items-center gap-2 text-sm">
          <Image src="/story.png" alt="ADA" width={16} height={16} />
          <span className="text-stone-300">
            {formatEther(balance?.value ?? BigInt("0"))} STORY
          </span>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`text-stone-300 border-stone-700 hover:bg-transparent hover:text-white ${
              isConnected
                ? userSide === "light"
                  ? "border-blue-600 text-blue-400"
                  : userSide === "dark"
                  ? "border-red-600 text-red-400"
                  : ""
                : ""
            }`}
            onClick={!isConnected ? openConnectModal : undefined}
            disabled={isConnected}
          >
            <Wallet className="w-4 h-4 mr-2" />
            {!isConnected
              ? "Connect Wallet"
              : `${address?.slice(0, 6)}...${address?.slice(-4)}`}
          </Button>
        </DropdownMenuTrigger>
        {isConnected && (
          <DropdownMenuContent
            align="end"
            className="bg-transparent border-none shadow-none hover:bg-transparent  focus:bg-transparent data-[state=open]:bg-transparent hover:text-red-400"
          >
            <DropdownMenuItem
              onClick={() => disconnect()}
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
