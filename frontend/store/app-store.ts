import { create } from "zustand";

type UserSide = "light" | "dark" | null;
type WalletStatus = "disconnected" | "connecting" | "connected";

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

interface AppState {
  walletStatus: WalletStatus;
  userSide: UserSide;
  logs: LogEntry[];
  connectWallet: () => Promise<void>;
  addLog: (message: string, type?: LogEntry["type"]) => void;
  setUserSide: (side: UserSide) => void;
}

export const useAppStore = create<AppState>((set) => ({
  walletStatus: "disconnected",
  userSide: null,
  logs: [],

  connectWallet: async () => {
    set({ walletStatus: "connecting" });
    // Simulate wallet connection
    setTimeout(() => {
      set((state) => ({
        walletStatus: "connected",
        logs: [
          {
            id: Date.now().toString(),
            timestamp: new Date(),
            message: "Wallet connected successfully",
            type: "success",
          },
          ...state.logs,
        ],
      }));
    }, 1500);
  },

  addLog: (message: string, type: LogEntry["type"] = "info") => {
    set((state) => ({
      logs: [
        {
          id: Date.now().toString(),
          timestamp: new Date(),
          message,
          type,
        },
        ...state.logs,
      ],
    }));
  },

  setUserSide: (side: UserSide) => set({ userSide: side }),
}));
