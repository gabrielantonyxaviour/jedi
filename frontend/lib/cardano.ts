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

export const parseCardanoBalance = (balanceHex: string): string => {
  // Remove '0x' prefix if present
  const hex = balanceHex.startsWith("0x") ? balanceHex.slice(2) : balanceHex;

  // Parse CBOR hex to get lovelace amount
  const buffer = Buffer.from(hex, "hex");

  // For simple balance, it's usually just the big integer value
  // Your hex "1b000000024e13431b" represents a large number
  const lovelace = parseInt(hex.slice(-16), 16); // Take last 8 bytes as the value

  // Convert lovelace to ADA (1 ADA = 1,000,000 lovelace)
  const ada = lovelace / 1_000_000;

  return ada.toFixed(6);
};
