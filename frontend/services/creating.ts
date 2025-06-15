import { SCHEMA_IDS } from "@/lib/nilion";
import { generateJWTs, createEncryptionService, fetchFromNode } from "./base";
import { CreatingData } from "@/lib/types";

export async function fetchCreatingByAddress(
  targetAddress: string
): Promise<CreatingData | null> {
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
    if (!recordMap.has(record.id)) {
      recordMap.set(record.id, { addressShares: [], initStepShares: [] });
    }
    const entry = recordMap.get(record.id);
    entry.addressShares.push(record.address["%share"]);
    entry.initStepShares.push(record.init_step["%share"]);
  });

  for (const [id, shares] of recordMap.entries()) {
    if (shares.addressShares.length === 3) {
      try {
        const [address, init_step] = await Promise.all([
          encryption.decrypt(shares.addressShares),
          encryption.decrypt(shares.initStepShares),
        ]);
        if (address === targetAddress) {
          return { address, init_step: init_step as CreatingData["init_step"] };
        }
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return null;
}
