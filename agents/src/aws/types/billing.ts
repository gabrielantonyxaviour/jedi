// src/types/billing.ts
export interface CreditConsumption {
  consumptionId: string;
  projectKey: string; // e.g., "franky-agents-router-12312323"
  agentName: string;
  action: string;
  description: string;
  usdConsumed: number;
  timestamp: string;
  workflowId?: string;
  taskId?: string;
  metadata?: any;
}

export interface PaymentRecord {
  paymentId: string;
  projectKey: string;
  addressPaid: string;
  usdValue: number;
  token: string;
  amount: string;
  txHash: string;
  chainId: number;
  timestamp: string;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number;
  gasUsed?: string;
  metadata?: any;
}

export interface ProjectFinancials {
  projectKey: string;
  totalDue: number;
  totalOverallUsed: number;
  totalOverallPaid: number;
  lastUpdated: string;
  creditBalance: number; // totalPaid - totalUsed
  status: "active" | "suspended" | "overdue";
}

export interface BillingResponse {
  financials: ProjectFinancials;
  payments: PaymentRecord[];
}

export interface CreditUsageResponse {
  projectKey: string;
  totalConsumed: number;
  consumptions: CreditConsumption[];
  dateRange: {
    from: string;
    to: string;
  };
}
