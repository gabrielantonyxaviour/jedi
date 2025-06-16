"use client";

import { http, createConfig, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { aurora } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ReactNode } from "react";

export const config = createConfig({
  chains: [aurora],
  connectors: [injected()],
  transports: {
    [aurora.id]: http(),
  },
});

const queryClient = new QueryClient();
interface TomoProviderProps {
  children: ReactNode;
}

export function TomoProvider({ children }: TomoProviderProps) {
  return (
    <WagmiProvider config={config as any}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
