export type AgentName =
  | "github"
  | "leads"
  | "socials"
  | "karma"
  | "ip"
  | "compliance"
  | "orchestrator";

export interface LogEntry {
  _id: string;
  projectId: string;
  agentName: AgentName;
  text: string;
  data: Record<string, any>;
  _created?: number;
  _updated?: number;
}

export interface GithubProject {
  id: string;
  name: string;
  description: string;
  technical_description: string;
  repo_url: string;
  owner: string;
  collab: string[];
  metadata: Record<string, any>;
}

export interface Lead {
  id: string;
  name: string;
  source: string;
  description: string;
  metadata: Record<string, any>;
}

export interface Story {
  id: string;
  name: string;
  desc: string;
  owners: string[];
  image_url: string;
  ipa: string;
  parent_ipa: string;
  remix_license_terms: "commercial" | "non-commercial";
  register_tx_hash: string;
}

export interface TwitterAction {
  id: string;
  action: "tweet" | "reply" | "like" | "retweet" | "quote";
  ref_id?: string;
  text: string;
}

export interface LinkedinAction {
  id: string;
  action: "post" | "reply" | "like" | "repost" | "quote";
  ref_id?: string;
  text: string;
}

export interface TelegramMessage {
  id: string;
  user_id: string;
  text: string;
}

export interface Social {
  _id: string; // Changed from 'id'
  twitter?: {
    username: string;
    email: { "%allot": string };
    password: { "%allot": string };
    actions: TwitterAction[];
  };
  telegram?: {
    botusername: string;
    bot_token: { "%allot": string };
    messages: TelegramMessage[];
  };
}

export interface GrantMilestone {
  id: string;
  name: string;
  desc: string;
  created_at: number;
}

export interface Grant {
  id: string;
  name: string;
  desc: string;
  applied_at: number;
  milestones: GrantMilestone[];
}

export interface GrantsCollection {
  id: string;
  name: string;
  desc: string;
  links: string[];
  image_url: string;
  owner: string;
  members: string[];
  user_email: { "%allot": string }; // encrypted
  user_name: string;
  grants: Grant[];
}

export interface Compliance {
  id: string;
  name: string;
  metadata: Record<string, any>;
}

export interface NillionConfig {
  orgCredentials: {
    secretKey: string;
    orgDid: string;
  };
  nodes: Array<{
    url: string;
    did: string;
  }>;
}

export type SocialPlatform = "twitter" | "telegram" | "linkedin";

export type SocialType = "account" | "bot" | "profile";

export interface SocialsCollection {
  id: string;
  name: string;
  description: string;
  platform: SocialPlatform;
  type: SocialType;
  accounts: Social[];
  metadata: Record<string, any>;
}
