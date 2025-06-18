export interface ComplianceData {
  name: string;
  project_id: string;
  owner_address: string;
  source: string;
  data: string;
}

export interface GithubData {
  name: string;
  description: string;
  technical_description: string;
  repo_url: string;
  owner: string;
  collab: string;
  owner_address: string;
  metadata: string;
}

export interface LeadsData {
  name: string;
  source: string;
  desc: string;
  metadata: string;
  owner_address: string;
  project_id: string;
}

export interface LogsData {
  owner_address: string;
  project_id: string;
  agent_name: string;
  text: string;
  data: string;
}

export interface StoriesData {
  owner_address: string;
  project_id: string;
  name: string;
  desc: string;
  owners: string;
  image_url: string;
  ipa: string;
  parent_ipa: string;
  remix_license_terms: string;
  register_tx_hash: string;
}

export interface SocialsData {
  owner_address: string;
  project_id: string;
  twitter: {
    name: string;
    email: string;
    password: string;
  };
  telegram: {
    username: string;
    bot_token: string;
  };
  twitter_actions: Array<{
    id: string;
    action: string;
    ref_id: string;
    text: string;
  }>;
  telegram_actions: Array<{
    id: string;
    text: string;
    ref_user_id: string;
  }>;
}

export interface GrantsData {
  project_id: string;
  name: string;
  desc: string;
  links: string;
  image_url: string;
  owner_address: string;
  members: string;
  user_email: string;
  user_name: string;
  grants: Array<{
    id: string;
    name: string;
    desc: string;
    applied_at: string;
  }>;
  milestones: Array<{
    id: string;
    grant_id: string;
    name: string;
    desc: string;
    created_at: string;
  }>;
}

export interface CreatingData {
  address: string;
  init_step: "github" | "setup" | "socials" | "karma" | "ip";
}

interface Developer {
  name: string;
  github_username: string;
}

export interface ProjectInfo {
  // Core Project Info
  projectId: string;
  name: string;
  description?: string;
  technicalDescription?: string;
  imageUrl?: string;

  // GitHub Integration
  githubUrl: string;
  repo: string;
  developers: Developer[];
  languages?: string[];

  // Project Metadata
  ownerId: string;
  side: "light" | "dark";
  summary?: string;
  technicalSummary?: string;
  industry?: string;
  keywords?: string[];

  // Setup Progress Tracking
  setup_state: "GITHUB" | "INFO" | "SOCIALS" | "KARMA" | "IP";
  setup_completed_steps: string[]; // ["GITHUB", "INFO", ...]
  setup_started_at: string;
  setup_completed_at?: string;

  // Social Media Agent Data
  socials?: {
    isSetup: boolean;
    platforms: {
      twitter?: {
        username: string;
        isActive: boolean;
        lastPost?: string;
        followers?: number;
        posts?: number;
      };
      linkedin?: {
        isActive: boolean;
        connections?: number;
        posts?: number;
      };
      telegram?: {
        botToken: string;
        isActive: boolean;
        members?: number;
      };
    };
    character: {
      name: string;
      personality: string;
      tone: string;
    };
    autoPost: boolean;
    postsPerDay: string;
    setupAt?: string;
  };

  // Karma Integration Data
  karma?: {
    isSetup: boolean;
    karmaUID?: string;
    karmaProjectId?: string;
    ownerAddress: string;
    members?: string[];
    grants: Array<{
      uid: string;
      title: string;
      status: string;
      communityUID: string;
      milestones: Array<{
        uid: string;
        title: string;
        status: string;
        dueDate: string;
        completedAt?: string;
      }>;
    }>;
    opportunities?: Array<{
      grantUID: string;
      communityName: string;
      grantTitle: string;
      deadline?: string;
      amount?: string;
    }>;
    setupAt?: string;
  };

  // IP Protection Data
  ip?: {
    isSetup: boolean;
    registrationId?: string;
    ipId?: string; // Story Protocol IP ID
    txHash?: string;
    licenseTermsIds?: string[];
    royaltyPercentage?: number;
    remixFee?: string;
    commercialRevShare?: number;
    licenses: Array<{
      licenseId: string;
      licenseType: "commercial_fork" | "custom_remix" | "open_source";
      derivativeIpId?: string;
      parentIpId?: string;
      txHash: string;
      createdAt: string;
    }>;
    disputes: Array<{
      disputeId: string;
      targetIpId: string;
      evidence: string;
      status: "pending" | "resolved" | "dismissed";
      createdAt: string;
    }>;
    royalties: Array<{
      transactionId: string;
      amount: string;
      token: string;
      type: "payment" | "claim";
      status: "pending" | "confirmed" | "failed";
      timestamp: number;
    }>;
    setupAt?: string;
  };

  // Compliance Monitoring Data
  compliance?: {
    isActive: boolean;
    similarProjects: Array<{
      complianceId: string;
      projectName: string;
      description: string;
      url: string;
      platform: string;
      similarity: number;
      status: "pending_review" | "flagged" | "cleared" | "reviewed";
      discoveredAt: string;
      reviewedAt?: string;
      flagReason?: string;
    }>;
    lastScanAt?: string;
    flaggedCount: number;
    totalScanned: number;
  };

  // Lead Generation Data
  leads?: {
    isActive: boolean;
    totalLeads: number;
    sources: Array<{
      source: string;
      count: number;
      lastScanned?: string;
    }>;
    leads: Array<{
      leadId: string;
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
      matchReason?: string;
    }>;
    lastScanAt?: string;
    highValueLeads: number; // score > 80
  };

  // Project Statistics
  stats?: {
    totalWorkflows: number;
    completedTasks: number;
    failedTasks: number;
    lastActivity?: string;
    uptime?: string;
  };

  // Timestamps
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}
