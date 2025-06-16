import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
  updateAtNode,
} from "./base";
import { CreatingData } from "../../types/nillion";

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

export async function updateCreating(
  recordId: string,
  updates: Partial<CreatingData>
): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);

  const encryptedUpdates: any = {};

  if (updates.address !== undefined) {
    const addressShares = await encryption.encrypt(updates.address);
    encryptedUpdates.address = { "%share": addressShares };
  }

  if (updates.init_step !== undefined) {
    const initStepShares = await encryption.encrypt(updates.init_step);
    encryptedUpdates.init_step = { "%share": initStepShares };
  }

  const results = await Promise.all(
    [0, 1, 2].map((index) => {
      const nodeUpdate: any = {};
      Object.keys(encryptedUpdates).forEach((key) => {
        nodeUpdate[key] = { "%share": encryptedUpdates[key]["%share"][index] };
      });

      return updateAtNode(
        index,
        recordId,
        nodeUpdate,
        jwts[index],
        SCHEMA_IDS.CREATING
      );
    })
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
    if (!recordMap.has(record.id)) {
      recordMap.set(record.id, { addressShares: [], initStepShares: [] });
    }
    const entry = recordMap.get(record.id);
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
