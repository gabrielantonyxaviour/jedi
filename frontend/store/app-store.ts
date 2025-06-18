import { AgentInteraction } from "@/components/layout/logs-sheet";
import { create } from "zustand";

type UserSide = "light" | "dark" | null;
type WalletStatus = "disconnected" | "connecting" | "connected";

interface AddAgentInteractionParams {
  sourceAgent:
    | "github"
    | "socials"
    | "leads"
    | "compliance"
    | "ip"
    | "karma"
    | "orchestrator"
    | "system";
  targetAgent?:
    | "github"
    | "socials"
    | "leads"
    | "compliance"
    | "ip"
    | "karma"
    | "orchestrator"
    | "system";
  type:
    | "task_created"
    | "task_completed"
    | "data_shared"
    | "error"
    | "notification"
    | "workflow_trigger";
  action: string;
  message: string;
  data?: any;
  status?: "pending" | "processing" | "completed" | "failed";
  workflowId?: string;
  taskId?: string;
  parentInteractionId?: string;
  duration?: number;
  errorMessage?: string;
}

interface AppState {
  walletStatus: WalletStatus;
  address: string;
  balance: string;
  projectId: string;
  userSide: UserSide;
  agentInteractions: AgentInteraction[];
  jobResponse: any;
  addAgentInteraction: (params: AddAgentInteractionParams) => void;
  clearAgentInteractions: () => void;
  setUserSide: (side: UserSide) => void;
  setWalletStatus: (status: WalletStatus) => void;
  setProjectId: (id: string) => void;
  setAddress: (address: string) => void;
  setBalance: (balance: string) => void;
  setJobResponse: (response: any) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  walletStatus: "disconnected",
  userSide: null,
  projectId: "",
  address: "",
  balance: "0",
  agentInteractions: [],
  jobResponse: null,

  setWalletStatus: (status: WalletStatus) => set({ walletStatus: status }),

  addAgentInteraction: (params: AddAgentInteractionParams) => {
    const state = get();
    const newInteraction: AgentInteraction = {
      interactionId: `client-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      projectId: state.projectId,
      timestamp: new Date().toISOString(),
      sourceAgent: params.sourceAgent as AgentInteraction["sourceAgent"],
      targetAgent: params.targetAgent as AgentInteraction["targetAgent"],
      type: params.type,
      action: params.action,
      message: params.message,
      data: params.data,
      status: params.status || "completed",
      workflowId: params.workflowId,
      taskId: params.taskId,
      parentInteractionId: params.parentInteractionId,
      duration: params.duration,
      retryCount: 0,
      errorMessage: params.errorMessage,
    };

    set((state) => ({
      agentInteractions: [newInteraction, ...state.agentInteractions],
    }));
  },

  clearAgentInteractions: () => set({ agentInteractions: [] }),

  setAddress: (address: string) => set({ address }),
  setProjectId: (id: string) => set({ projectId: id }),
  setBalance: (balance: string) => set({ balance }),
  setUserSide: (side: UserSide) => set({ userSide: side }),
  setJobResponse: (response: any) => set({ jobResponse: response }),
}));
