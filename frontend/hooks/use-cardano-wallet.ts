// hooks/useCardanoWallet.ts
import { useState, useEffect } from "react";
import { connectWallet, getAvailableWallets } from "@/lib/cardano";

export const useCardanoWallet = () => {
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [walletApi, setWalletApi] = useState<any>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);

  useEffect(() => {
    setAvailableWallets(getAvailableWallets());
  }, []);

  const connect = async (walletName: string) => {
    try {
      const api = await connectWallet(walletName);
      setWalletApi(api);
      setConnectedWallet(walletName);

      // Get address and balance
      const addresses = await api.getUsedAddresses();
      if (addresses.length > 0) {
        setAddress(addresses[0]);
      }

      const balanceHex = await api.getBalance();
      setBalance(balanceHex);

      return api;
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    }
  };

  const disconnect = () => {
    setConnectedWallet(null);
    setWalletApi(null);
    setAddress(null);
    setBalance(null);
  };

  return {
    connectedWallet,
    walletApi,
    address,
    balance,
    availableWallets,
    connect,
    disconnect,
    isConnected: !!connectedWallet,
  };
};
