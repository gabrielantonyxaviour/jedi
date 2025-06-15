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

  const [nameShares, sourceShares, descShares, metadataShares] =
    await Promise.all([
      encryption.encrypt(data.name),
      encryption.encrypt(data.source),
      encryption.encrypt(data.desc),
      encryption.encrypt(data.metadata),
    ]);

  const results = await Promise.all(
    [0, 1, 2].map((index) =>
      uploadToNode(
        index,
        {
          _id: recordId,
          name: { "%share": nameShares[index] },
          source: { "%share": sourceShares[index] },
          desc: { "%share": descShares[index] },
          metadata: { "%share": metadataShares[index] },
        },
        jwts[index],
        SCHEMA_IDS.LEADS
      )
    )
  );

  return results.every(Boolean);
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
    if (!recordMap.has(record._id)) {
      recordMap.set(record._id, {
        nameShares: [],
        sourceShares: [],
        descShares: [],
        metadataShares: [],
      });
    }
    const entry = recordMap.get(record._id);
    entry.nameShares.push(record.name["%share"]);
    entry.sourceShares.push(record.source["%share"]);
    entry.descShares.push(record.desc["%share"]);
    entry.metadataShares.push(record.metadata["%share"]);
  });

  const decrypted: LeadsData[] = [];
  for (const [id, shares] of Array.from(recordMap.entries())) {
    if (shares.nameShares.length === 3) {
      try {
        const [name, source, desc, metadata] = await Promise.all([
          encryption.decrypt(shares.nameShares),
          encryption.decrypt(shares.sourceShares),
          encryption.decrypt(shares.descShares),
          encryption.decrypt(shares.metadataShares),
        ]);
        decrypted.push({ name, source, desc, metadata });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return decrypted;
}

async function main() {
  const success = await pushLeads({
    name: "John Smith",
    source: "LinkedIn",
    desc: "Senior Developer interested in blockchain",
    metadata: "Location: San Francisco, Skills: React, Node.js",
  });

  console.log(success ? "✓ Leads data pushed" : "✗ Push failed");

  const records = await fetchLeads();
  console.log("Leads records:", records);
}

if (require.main === module) {
  main().catch(console.error);
}
