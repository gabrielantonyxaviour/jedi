import { create } from "zustand";

type UserSide = "light" | "dark" | null;
type WalletStatus = "disconnected" | "connecting" | "connected";

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: "info" | "success" | "error" | "warning";
  agentId: string;
}

interface AppState {
  walletStatus: WalletStatus;
  userSide: UserSide;
  logs: LogEntry[];
  addLog: (message: string, agentId: string, type?: LogEntry["type"]) => void;
  setUserSide: (side: UserSide) => void;
  setWalletStatus: (status: WalletStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  walletStatus: "disconnected",
  userSide: null,
  logs: [],
  setWalletStatus: (status: WalletStatus) => set({ walletStatus: status }),
  addLog: (
    message: string,
    agentId: string,
    type: LogEntry["type"] = "info"
  ) => {
    set((state) => ({
      logs: [
        {
          id: Date.now().toString(),
          timestamp: new Date(),
          message,
          type,
          agentId,
        },
        ...state.logs,
      ],
    }));
  },

  setUserSide: (side: UserSide) => set({ userSide: side }),
}));
