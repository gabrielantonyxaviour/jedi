export interface ComplianceProject {
  complianceId: string;
  originalProjectId: string;
  projectName: string;
  description: string;
  url: string;
  platform: string;
  hackathon?: string;
  tags: string[];
  similarity: number; // 0-100 similarity score
  status: "pending_review" | "reviewed" | "flagged" | "cleared";
  source: string;
  discoveredAt: string;
  reviewedAt?: string;
  flagReason?: string;
  metadata?: Record<string, any>;
}
