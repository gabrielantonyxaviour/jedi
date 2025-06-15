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
  project_id: EncryptedField;
  agent_name: EncryptedField;
  text: EncryptedField;
  data: EncryptedField;
}

export interface GithubProject {
  _id: string;
  name: EncryptedField;
  description: EncryptedField;
  technical_description: EncryptedField;
  repo_url: EncryptedField;
  owner: EncryptedField;
  collab: EncryptedField;
  owner_address: EncryptedField;
  metadata: EncryptedField;
}

export interface Lead {
  _id: string;
  name: EncryptedField;
  source: EncryptedField;
  desc: EncryptedField;
  metadata: EncryptedField;
}

export interface Story {
  _id: string;
  name: EncryptedField;
  desc: EncryptedField;
  owners: EncryptedField;
  image_url: EncryptedField;
  ipa: EncryptedField;
  parent_ipa: EncryptedField;
  remix_license_terms: EncryptedField;
  register_tx_hash: EncryptedField;
}

export interface TwitterAction {
  id: EncryptedField;
  action: EncryptedField;
  ref_id: EncryptedField;
  text: EncryptedField;
}

export interface LinkedinAction {
  id: string;
  action: "post" | "reply" | "like" | "repost" | "quote";
  ref_id?: string;
  text: string;
}

export interface TelegramAction {
  id: EncryptedField;
  text: EncryptedField;
  ref_user_id: EncryptedField;
}

export interface Social {
  _id: string;
  twitter: {
    name: EncryptedField;
    email: EncryptedField;
    password: EncryptedField;
  };
  telegram: {
    username: EncryptedField;
    bot_token: EncryptedField;
  };
  twitter_actions: TwitterAction[];
  telegram_actions: TelegramAction[];
}

export interface Grant {
  id: EncryptedField;
  name: EncryptedField;
  desc: EncryptedField;
  applied_at: EncryptedField;
}

export interface Milestone {
  id: EncryptedField;
  grant_id: EncryptedField;
  name: EncryptedField;
  desc: EncryptedField;
  created_at: EncryptedField;
}

export interface GrantsCollection {
  _id: string;
  name: EncryptedField;
  desc: EncryptedField;
  links: EncryptedField;
  image_url: EncryptedField;
  owner_address: EncryptedField;
  members: EncryptedField;
  user_email: EncryptedField;
  user_name: EncryptedField;
  grants: Grant[];
  milestones: Milestone[];
}

export interface Compliance {
  _id: string;
  name: EncryptedField;
  source: EncryptedField;
  data: EncryptedField;
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

export type EncryptedField = {
  "%share": string;
};
