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
