export const SCHEMA_IDS = {
  COMPLIANCE: process.env.COMPLIANCE_SCHEMA_ID!,
  GITHUB: process.env.GITHUB_SCHEMA_ID!,
  LEADS: process.env.LEADS_SCHEMA_ID!,
  LOGS: process.env.LOGS_SCHEMA_ID!,
  STORIES: process.env.STORIES_SCHEMA_ID!,
  SOCIALS: process.env.SOCIALS_SCHEMA_ID!,
  GRANTS: process.env.GRANTS_SCHEMA_ID!,
  CREATING: process.env.CREATING_SCHEMA_ID!,
};

export const NODE_URLS = [
  process.env.NODE_0_URL || "https://node0.nilion.com",
  process.env.NODE_1_URL || "https://node1.nilion.com",
  process.env.NODE_2_URL || "https://node2.nilion.com",
];
