import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
  updateAtNode,
} from "./base";
import { LeadsData } from "../../types/nillion";

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
          owner_address: { "%share": ownerAddrShares[index] },
          project_id: { "%share": projectIdShares[index] },
        },
        jwts[index],
        SCHEMA_IDS.LEADS
      )
    )
  );

  return results.every(Boolean);
}

export async function updateLeads(
  recordId: string,
  updates: Partial<LeadsData>
): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);

  const encryptedUpdates: any = {};

  if (updates.name !== undefined) {
    const nameShares = await encryption.encrypt(updates.name);
    encryptedUpdates.name = { "%share": nameShares };
  }

  if (updates.source !== undefined) {
    const sourceShares = await encryption.encrypt(updates.source);
    encryptedUpdates.source = { "%share": sourceShares };
  }

  if (updates.desc !== undefined) {
    const descShares = await encryption.encrypt(updates.desc);
    encryptedUpdates.desc = { "%share": descShares };
  }

  if (updates.metadata !== undefined) {
    const metadataShares = await encryption.encrypt(updates.metadata);
    encryptedUpdates.metadata = { "%share": metadataShares };
  }

  if (updates.owner_address !== undefined) {
    const ownerAddrShares = await encryption.encrypt(updates.owner_address);
    encryptedUpdates.owner_address = { "%share": ownerAddrShares };
  }

  if (updates.project_id !== undefined) {
    const projectIdShares = await encryption.encrypt(updates.project_id);
    encryptedUpdates.project_id = { "%share": projectIdShares };
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
        SCHEMA_IDS.LEADS
      );
    })
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
