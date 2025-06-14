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
  projectId: string;
  userSide: UserSide;
  logs: LogEntry[];
  jobResponse: any;
  addLog: (message: string, agentId: string, type?: LogEntry["type"]) => void;
  setUserSide: (side: UserSide) => void;
  setWalletStatus: (status: WalletStatus) => void;
  setProjectId: (id: string) => void;
  setAddress: (address: string) => void;
  setBalance: (balance: string) => void;
  setJobResponse: (response: any) => void;
}

export const useAppStore = create<AppState>((set) => ({
  walletStatus: "disconnected",
  userSide: null,
  projectId: "",
  address: "",
  balance: "0",
  logs: [],
  jobResponse: null,
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
  setProjectId: (id: string) => set({ projectId: id }),
  setBalance: (balance: string) => set({ balance }),
  setUserSide: (side: UserSide) => set({ userSide: side }),
  setJobResponse: (response: any) => set({ jobResponse: response }),
}));
