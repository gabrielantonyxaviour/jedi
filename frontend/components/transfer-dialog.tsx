"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAppStore } from "@/store/app-store";

interface TransferDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function TransferDialog({ open, onClose }: TransferDialogProps) {
  const [txHash, setTxHash] = useState("");
  const { address, addLog, jobResponse } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    addLog("Transaction verified", "orchestrator", "success");
    addLog("Relaying Purchase to Masumi", "orchestrator", "info");

    try {
      const response = await fetch("/api/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifierFromPurchaser: address,
          sellerVkey: process.env.NEXT_PUBLIC_MASUMI_SELLER_VKEY,
          blockchainIdentifier: jobResponse.blockchain_identifier,
          submitResultTime: jobResponse.submit_result_time,
          unlockTime: jobResponse.unlock_time,
          externalDisputeUnlockTime: jobResponse.external_dispute_unlock_time,
          agentIdentifier: process.env.NEXT_PUBLIC_MASUMI_AGENT_IDENTIFIER,
          inputHash: jobResponse.input_hash,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to relay purchase");
      }

      const data = await response.json();
      addLog("Purchase relayed successfully", "orchestrator", "success");
    } catch (error) {
      console.error("Error relaying purchase:", error);
      addLog("Failed to relay purchase", "orchestrator", "error");
    }

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-white">Deposit ADA</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-zinc-400">
              Send exactly 5 ADA to this address:
            </p>
            <div className="p-3 bg-zinc-800 rounded-md">
              <code className="text-sm text-zinc-300 break-all">{address}</code>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="txHash" className="text-sm text-zinc-400">
                Transaction Hash
              </label>
              <Input
                id="txHash"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Enter your transaction hash"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Verify Transaction
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
