import { getDefaultConfig, TomoEVMKitProvider } from "@tomo-inc/tomo-evm-kit";
import { WagmiProvider } from "wagmi";
import { storyAeneid } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ReactNode } from "react";

const config = getDefaultConfig({
  clientId: process.env.NEXT_PUBLIC_TOMO_CLIENT_ID,
  appName: "Jedi",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [storyAeneid],
  ssr: true,
});

const queryClient = new QueryClient();

interface TomoProviderProps {
  children: ReactNode;
}

export function TomoProvider({ children }: TomoProviderProps) {
  return (
    <WagmiProvider config={config as any}>
      <QueryClientProvider client={queryClient}>
        <TomoEVMKitProvider>{children}</TomoEVMKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
