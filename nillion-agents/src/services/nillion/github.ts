import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
  updateAtNode,
} from "./base";
import { GithubData } from "../../types/nillion";

export async function pushGithub(data: GithubData): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const recordId = uuidv4();

  const [
    nameShares,
    descShares,
    techDescShares,
    repoShares,
    ownerShares,
    collabShares,
    ownerAddrShares,
    metadataShares,
  ] = await Promise.all([
    encryption.encrypt(data.name),
    encryption.encrypt(data.description),
    encryption.encrypt(data.technical_description),
    encryption.encrypt(data.repo_url),
    encryption.encrypt(data.owner),
    encryption.encrypt(data.collab),
    encryption.encrypt(data.owner_address),
    encryption.encrypt(data.metadata),
  ]);

  const results = await Promise.all(
    [0, 1, 2].map((index) =>
      uploadToNode(
        index,
        {
          _id: recordId,
          name: { "%share": nameShares[index] },
          description: { "%share": descShares[index] },
          technical_description: { "%share": techDescShares[index] },
          repo_url: { "%share": repoShares[index] },
          owner: { "%share": ownerShares[index] },
          collab: { "%share": collabShares[index] },
          owner_address: { "%share": ownerAddrShares[index] },
          metadata: { "%share": metadataShares[index] },
        },
        jwts[index],
        SCHEMA_IDS.GITHUB
      )
    )
  );

  return results.every(Boolean);
}

export async function updateGithub(
  recordId: string,
  updates: Partial<GithubData>
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

  if (updates.description !== undefined) {
    const descShares = await encryption.encrypt(updates.description);
    encryptedUpdates.description = { "%share": descShares };
  }

  if (updates.technical_description !== undefined) {
    const techDescShares = await encryption.encrypt(
      updates.technical_description
    );
    encryptedUpdates.technical_description = { "%share": techDescShares };
  }

  if (updates.repo_url !== undefined) {
    const repoShares = await encryption.encrypt(updates.repo_url);
    encryptedUpdates.repo_url = { "%share": repoShares };
  }

  if (updates.owner !== undefined) {
    const ownerShares = await encryption.encrypt(updates.owner);
    encryptedUpdates.owner = { "%share": ownerShares };
  }

  if (updates.collab !== undefined) {
    const collabShares = await encryption.encrypt(updates.collab);
    encryptedUpdates.collab = { "%share": collabShares };
  }

  if (updates.owner_address !== undefined) {
    const ownerAddrShares = await encryption.encrypt(updates.owner_address);
    encryptedUpdates.owner_address = { "%share": ownerAddrShares };
  }

  if (updates.metadata !== undefined) {
    const metadataShares = await encryption.encrypt(updates.metadata);
    encryptedUpdates.metadata = { "%share": metadataShares };
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
        SCHEMA_IDS.GITHUB
      );
    })
  );

  return results.every(Boolean);
}

export async function fetchGithub(): Promise<GithubData[]> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const allRecords = await Promise.all(
    [0, 1, 2].map((index) =>
      fetchFromNode(index, jwts[index], SCHEMA_IDS.GITHUB)
    )
  );

  const recordMap = new Map();
  allRecords.flat().forEach((record) => {
    if (!recordMap.has(record.id)) {
      recordMap.set(record.id, {
        nameShares: [],
        descShares: [],
        techDescShares: [],
        repoShares: [],
        ownerShares: [],
        collabShares: [],
        ownerAddrShares: [],
        metadataShares: [],
      });
    }
    const entry = recordMap.get(record.id);
    entry.nameShares.push(record.name["%share"]);
    entry.descShares.push(record.description["%share"]);
    entry.techDescShares.push(record.technical_description["%share"]);
    entry.repoShares.push(record.repo_url["%share"]);
    entry.ownerShares.push(record.owner["%share"]);
    entry.collabShares.push(record.collab["%share"]);
    entry.ownerAddrShares.push(record.owner_address["%share"]);
    entry.metadataShares.push(record.metadata["%share"]);
  });

  const decrypted: GithubData[] = [];
  for (const [id, shares] of Array.from(recordMap.entries())) {
    if (shares.nameShares.length === 3) {
      try {
        const [
          name,
          description,
          technical_description,
          repo_url,
          owner,
          collab,
          owner_address,
          metadata,
        ] = await Promise.all([
          encryption.decrypt(shares.nameShares),
          encryption.decrypt(shares.descShares),
          encryption.decrypt(shares.techDescShares),
          encryption.decrypt(shares.repoShares),
          encryption.decrypt(shares.ownerShares),
          encryption.decrypt(shares.collabShares),
          encryption.decrypt(shares.ownerAddrShares),
          encryption.decrypt(shares.metadataShares),
        ]);
        decrypted.push({
          name,
          description,
          technical_description,
          repo_url,
          owner,
          collab,
          owner_address,
          metadata,
        });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return decrypted;
}

export async function fetchGithubByAddress(
  targetAddress: string
): Promise<GithubData[]> {
  const allRecords = await fetchGithub();
  return allRecords.filter((record) => record.owner_address === targetAddress);
}
