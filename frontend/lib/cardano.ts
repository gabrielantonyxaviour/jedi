// utils/cardano.ts
interface CardanoWallet {
  name: string;
  icon: string;
  apiVersion: string;
  enable(): Promise<CardanoApi>;
  isEnabled(): Promise<boolean>;
}

interface CardanoApi {
  getNetworkId(): Promise<number>;
  getUtxos(): Promise<string[]>;
  getBalance(): Promise<string>;
  getUsedAddresses(): Promise<string[]>;
  getUnusedAddresses(): Promise<string[]>;
  getChangeAddress(): Promise<string>;
  getRewardAddresses(): Promise<string[]>;
  signTx(tx: string, partialSign?: boolean): Promise<string>;
  signData(
    addr: string,
    payload: string
  ): Promise<{ signature: string; key: string }>;
  submitTx(tx: string): Promise<string>;
}

declare global {
  interface Window {
    cardano: {
      [key: string]: CardanoWallet;
    };
  }
}

export const getAvailableWallets = (): string[] => {
  if (typeof window === "undefined") return [];
  return Object.keys(window.cardano || {});
};

export const connectWallet = async (
  walletName: string
): Promise<CardanoApi> => {
  if (!window.cardano?.[walletName]) {
    throw new Error(`${walletName} wallet not found`);
  }

  const wallet = window.cardano[walletName];
  return await wallet.enable();
};
