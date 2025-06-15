import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
} from "./base";
import { CreatingData } from "./types";

export async function pushCreating(data: CreatingData): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const recordId = uuidv4();

  const [addressShares, initStepShares] = await Promise.all([
    encryption.encrypt(data.address),
    encryption.encrypt(data.init_step),
  ]);

  const results = await Promise.all(
    [0, 1, 2].map((index) =>
      uploadToNode(
        index,
        {
          _id: recordId,
          address: { "%share": addressShares[index] },
          init_step: { "%share": initStepShares[index] },
        },
        jwts[index],
        SCHEMA_IDS.CREATING
      )
    )
  );

  return results.every(Boolean);
}

export async function fetchCreating(): Promise<CreatingData[]> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const allRecords = await Promise.all(
    [0, 1, 2].map((index) =>
      fetchFromNode(index, jwts[index], SCHEMA_IDS.CREATING)
    )
  );

  const recordMap = new Map();
  allRecords.flat().forEach((record) => {
    if (!recordMap.has(record._id)) {
      recordMap.set(record._id, { addressShares: [], initStepShares: [] });
    }
    const entry = recordMap.get(record._id);
    entry.addressShares.push(record.address["%share"]);
    entry.initStepShares.push(record.init_step["%share"]);
  });

  const decrypted: CreatingData[] = [];
  for (const [id, shares] of Array.from(recordMap.entries())) {
    if (shares.addressShares.length === 3) {
      try {
        const [address, init_step] = await Promise.all([
          encryption.decrypt(shares.addressShares),
          encryption.decrypt(shares.initStepShares),
        ]);
        decrypted.push({
          address,
          init_step: init_step as CreatingData["init_step"],
        });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return decrypted;
}

export async function fetchByAddress(
  targetAddress: string
): Promise<CreatingData | null> {
  const allRecords = await fetchCreating();
  return allRecords.find((record) => record.address === targetAddress) || null;
}

async function main() {
  const success = await pushCreating({
    address: "0x0690675C3Fea492a5FB98A9F20DA27efc40602b4",
    init_step: "github",
  });

  console.log(success ? "✓ Creating data pushed" : "✗ Push failed");

  const records = await fetchCreating();
  console.log("Creating records:", records);

  // Test fetch by address
  const specific = await fetchByAddress(
    "0x0690675C3Fea492a5FB98A9F20DA27efc40602b4"
  );
  console.log("Found by address:", specific);
}

if (require.main === module) {
  main().catch(console.error);
}
