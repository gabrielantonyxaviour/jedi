import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
} from "./base";
import { ComplianceData } from "./types";

export async function pushCompliance(data: ComplianceData): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const recordId = uuidv4();

  const [nameShares, sourceShares, dataShares] = await Promise.all([
    encryption.encrypt(data.name),
    encryption.encrypt(data.source),
    encryption.encrypt(data.data),
  ]);

  const results = await Promise.all(
    [0, 1, 2].map((index) =>
      uploadToNode(
        index,
        {
          _id: recordId,
          name: { "%share": nameShares[index] },
          source: { "%share": sourceShares[index] },
          data: { "%share": dataShares[index] },
        },
        jwts[index],
        SCHEMA_IDS.COMPLIANCE
      )
    )
  );

  return results.every(Boolean);
}

export async function fetchCompliance(): Promise<ComplianceData[]> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const allRecords = await Promise.all(
    [0, 1, 2].map((index) =>
      fetchFromNode(index, jwts[index], SCHEMA_IDS.COMPLIANCE)
    )
  );

  const recordMap = new Map();
  allRecords.flat().forEach((record) => {
    if (!recordMap.has(record._id)) {
      recordMap.set(record._id, {
        nameShares: [],
        sourceShares: [],
        dataShares: [],
      });
    }
    const entry = recordMap.get(record._id);
    entry.nameShares.push(record.name["%share"]);
    entry.sourceShares.push(record.source["%share"]);
    entry.dataShares.push(record.data["%share"]);
  });

  const decrypted: ComplianceData[] = [];
  for (const [id, shares] of Array.from(recordMap.entries())) {
    if (shares.nameShares.length === 3) {
      try {
        const [name, source, data] = await Promise.all([
          encryption.decrypt(shares.nameShares),
          encryption.decrypt(shares.sourceShares),
          encryption.decrypt(shares.dataShares),
        ]);
        decrypted.push({ name, source, data });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return decrypted;
}

async function main() {
  const success = await pushCompliance({
    name: "GDPR Compliance Report",
    source: "EU Data Protection Officer",
    data: "All customer data properly anonymized and stored according to GDPR requirements.",
  });

  console.log(success ? "✓ Compliance data pushed" : "✗ Push failed");

  const records = await fetchCompliance();
  console.log("Compliance records:", records);
}

if (require.main === module) {
  main().catch(console.error);
}
