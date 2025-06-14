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
  address: string;
  balance: string;
  userSide: UserSide;
  logs: LogEntry[];
  addLog: (message: string, agentId: string, type?: LogEntry["type"]) => void;
  setUserSide: (side: UserSide) => void;
  setWalletStatus: (status: WalletStatus) => void;
  setAddress: (address: string) => void;
  setBalance: (balance: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  walletStatus: "disconnected",
  userSide: null,
  address: "",
  balance: "0",
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
  setAddress: (address: string) => set({ address }),
  setBalance: (balance: string) => set({ balance }),
  setUserSide: (side: UserSide) => set({ userSide: side }),
}));
