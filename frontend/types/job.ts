// types/job.ts
export interface JobInput {
  identifier_from_purchaser: string;
  input_data: {
    text: string;
    [key: string]: any;
  };
}

export interface JobResponse {
  status: string;
  job_id: string;
  blockchainIdentifier: string;
  submitResultTime: string;
  unlockTime: string;
  externalDisputeUnlockTime: string;
  agentIdentifier: string;
  sellerVkey: string;
  identifierFromPurchaser: string;
  amounts: Array<{
    amount: string;
    unit: string;
  }>;
  input_hash: string;
}

export interface PurchaseInput {
  identifierFromPurchaser: string;
  network?: string;
  sellerVkey: string;
  paymentType?: string;
  blockchainIdentifier: string;
  submitResultTime: string;
  unlockTime: string;
  externalDisputeUnlockTime: string;
  agentIdentifier: string;
  inputHash: string;
}

export interface ApiError {
  error: string;
}
