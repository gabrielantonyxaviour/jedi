"use client";

import {
  darkTheme,
  getDefaultConfig,
  TomoEVMKitProvider,
} from "@tomo-inc/tomo-evm-kit";
import { WagmiProvider } from "wagmi";
import { aurora, storyAeneid } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ReactNode } from "react";
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@tomo-inc/tomo-evm-kit/wallets";

const config = getDefaultConfig({
  clientId: process.env.NEXT_PUBLIC_TOMO_CLIENT_ID, // Replace with your clientId
  appName: "Jedi",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "", // Note: Every dApp that relies on WalletConnect now needs to obtain a projectId from WalletConnect Cloud.
  chains: [aurora],

  wallets: [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
        rainbowWallet,
        walletConnectWallet, // Add other wallets if needed
      ],
    },
  ],
  ssr: true, // If your dApp uses server-side rendering (SSR)
});

const queryClient = new QueryClient();
interface TomoProviderProps {
  children: ReactNode;
}

export function TomoProvider({ children }: TomoProviderProps) {
  return (
    <WagmiProvider config={config as any}>
      <QueryClientProvider client={queryClient}>
        <TomoEVMKitProvider
          theme={darkTheme({
            accentColor: "stone-700",
            accentColorForeground: "white",
          })}
        >
          {children}
        </TomoEVMKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
