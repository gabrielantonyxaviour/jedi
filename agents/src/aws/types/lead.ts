// src/types/Lead.ts
export interface Lead {
  leadId: string;
  projectId: string;
  name: string;
  email?: string;
  company?: string;
  title?: string;
  website?: string;
  industry?: string;
  location?: string;
  score: number;
  status: "new" | "contacted" | "qualified" | "converted" | "rejected";
  source: string;
  discoveredAt: string;
  lastContactedAt?: string;
  notes?: string;
  metadata?: Record<string, any>;
  matchReason?: string;
}

export interface ScrapingResult {
  success: boolean;
  source: string;
  leads: Lead[];
  error?: string;
}
