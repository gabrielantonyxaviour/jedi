import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
} from "./base";
import { LeadsData } from "./types";

export async function pushLeads(data: LeadsData): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const recordId = uuidv4();

  const [
    nameShares,
    sourceShares,
    descShares,
    metadataShares,
    ownerAddrShares,
    projectIdShares,
  ] = await Promise.all([
    encryption.encrypt(data.name),
    encryption.encrypt(data.source),
    encryption.encrypt(data.desc),
    encryption.encrypt(data.metadata),
    encryption.encrypt(data.owner_address),
    encryption.encrypt(data.project_id),
  ]);

  const payloads = await Promise.all(
    [0, 1, 2].map((index) =>
      uploadToNode(
        index,
        {
          _id: recordId,
          name: { "%share": nameShares[index] },
          source: { "%share": sourceShares[index] },
          desc: { "%share": descShares[index] },
          metadata: { "%share": metadataShares[index] },
          owner_address: { "%share": ownerAddrShares[index] },
          project_id: { "%share": projectIdShares[index] },
        },
        jwts[index],
        SCHEMA_IDS.LEADS
      )
    )
  );

  return payloads.every(Boolean);
}

export async function fetchLeads(): Promise<LeadsData[]> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const allRecords = await Promise.all(
    [0, 1, 2].map((index) =>
      fetchFromNode(index, jwts[index], SCHEMA_IDS.LEADS)
    )
  );

  const recordMap = new Map();
  allRecords.flat().forEach((record) => {
    if (!recordMap.has(record.id)) {
      recordMap.set(record.id, {
        nameShares: [],
        sourceShares: [],
        descShares: [],
        metadataShares: [],
        ownerAddrShares: [],
        projectIdShares: [],
      });
    }
    const entry = recordMap.get(record.id);
    entry.nameShares.push(record.name["%share"]);
    entry.sourceShares.push(record.source["%share"]);
    entry.descShares.push(record.desc["%share"]);
    entry.metadataShares.push(record.metadata["%share"]);
    entry.ownerAddrShares.push(record.owner_address["%share"]);
    entry.projectIdShares.push(record.project_id["%share"]);
  });

  const decrypted: LeadsData[] = [];
  for (const [id, shares] of Array.from(recordMap.entries())) {
    if (shares.nameShares.length === 3) {
      try {
        const [name, source, desc, metadata, owner_address, project_id] =
          await Promise.all([
            encryption.decrypt(shares.nameShares),
            encryption.decrypt(shares.sourceShares),
            encryption.decrypt(shares.descShares),
            encryption.decrypt(shares.metadataShares),
            encryption.decrypt(shares.ownerAddrShares),
            encryption.decrypt(shares.projectIdShares),
          ]);
        decrypted.push({
          name,
          source,
          desc,
          metadata,
          owner_address,
          project_id,
        });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return decrypted;
}

export async function fetchLeadsByAddress(
  targetAddress: string
): Promise<LeadsData[]> {
  const allRecords = await fetchLeads();
  return allRecords.filter((record) => record.owner_address === targetAddress);
}

async function main() {
  const success = await pushLeads({
    name: "John Smith",
    source: "LinkedIn",
    desc: "Senior Developer interested in blockchain",
    metadata: "Location: San Francisco, Skills: React, Node.js",
    owner_address: "0x1234567890abcdef",
    project_id: "proj_123",
  });

  console.log(success ? "✓ Leads data pushed" : "✗ Push failed");

  const records = await fetchLeads();
  console.log("Leads records:", records);
}

if (require.main === module) {
  main().catch(console.error);
}
