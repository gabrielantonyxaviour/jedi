import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
  updateAtNode,
} from "./base";
import { StoriesData } from "../../types/nillion";

export async function pushStories(data: StoriesData): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const recordId = uuidv4();

  const [
    ownerAddrShares,
    projectIdShares,
    nameShares,
    descShares,
    ownersShares,
    imageShares,
    ipaShares,
    parentIpaShares,
    licenseShares,
    txHashShares,
  ] = await Promise.all([
    encryption.encrypt(data.owner_address),
    encryption.encrypt(data.project_id),
    encryption.encrypt(data.name),
    encryption.encrypt(data.desc),
    encryption.encrypt(data.owners),
    encryption.encrypt(data.image_url),
    encryption.encrypt(data.ipa),
    encryption.encrypt(data.parent_ipa),
    encryption.encrypt(data.remix_license_terms),
    encryption.encrypt(data.register_tx_hash),
  ]);

  const results = await Promise.all(
    [0, 1, 2].map((index) =>
      uploadToNode(
        index,
        {
          _id: recordId,
          owner_address: { "%share": ownerAddrShares[index] },
          project_id: { "%share": projectIdShares[index] },
          name: { "%share": nameShares[index] },
          desc: { "%share": descShares[index] },
          owners: { "%share": ownersShares[index] },
          image_url: { "%share": imageShares[index] },
          ipa: { "%share": ipaShares[index] },
          parent_ipa: { "%share": parentIpaShares[index] },
          remix_license_terms: { "%share": licenseShares[index] },
          register_tx_hash: { "%share": txHashShares[index] },
        },
        jwts[index],
        SCHEMA_IDS.STORIES
      )
    )
  );

  return results.every(Boolean);
}

export async function updateStories(
  recordId: string,
  updates: Partial<StoriesData>
): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);

  const encryptedUpdates: any = {};

  if (updates.owner_address !== undefined) {
    const ownerAddrShares = await encryption.encrypt(updates.owner_address);
    encryptedUpdates.owner_address = { "%share": ownerAddrShares };
  }

  if (updates.project_id !== undefined) {
    const projectIdShares = await encryption.encrypt(updates.project_id);
    encryptedUpdates.project_id = { "%share": projectIdShares };
  }

  if (updates.name !== undefined) {
    const nameShares = await encryption.encrypt(updates.name);
    encryptedUpdates.name = { "%share": nameShares };
  }

  if (updates.desc !== undefined) {
    const descShares = await encryption.encrypt(updates.desc);
    encryptedUpdates.desc = { "%share": descShares };
  }

  if (updates.owners !== undefined) {
    const ownersShares = await encryption.encrypt(updates.owners);
    encryptedUpdates.owners = { "%share": ownersShares };
  }

  if (updates.image_url !== undefined) {
    const imageShares = await encryption.encrypt(updates.image_url);
    encryptedUpdates.image_url = { "%share": imageShares };
  }

  if (updates.ipa !== undefined) {
    const ipaShares = await encryption.encrypt(updates.ipa);
    encryptedUpdates.ipa = { "%share": ipaShares };
  }

  if (updates.parent_ipa !== undefined) {
    const parentIpaShares = await encryption.encrypt(updates.parent_ipa);
    encryptedUpdates.parent_ipa = { "%share": parentIpaShares };
  }

  if (updates.remix_license_terms !== undefined) {
    const licenseShares = await encryption.encrypt(updates.remix_license_terms);
    encryptedUpdates.remix_license_terms = { "%share": licenseShares };
  }

  if (updates.register_tx_hash !== undefined) {
    const txHashShares = await encryption.encrypt(updates.register_tx_hash);
    encryptedUpdates.register_tx_hash = { "%share": txHashShares };
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
        SCHEMA_IDS.STORIES
      );
    })
  );

  return results.every(Boolean);
}

export async function fetchStories(): Promise<StoriesData[]> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const allRecords = await Promise.all(
    [0, 1, 2].map((index) =>
      fetchFromNode(index, jwts[index], SCHEMA_IDS.STORIES)
    )
  );

  const recordMap = new Map();
  allRecords.flat().forEach((record) => {
    if (!recordMap.has(record._id)) {
      recordMap.set(record._id, {
        ownerAddrShares: [],
        projectIdShares: [],
        nameShares: [],
        descShares: [],
        ownersShares: [],
        imageShares: [],
        ipaShares: [],
        parentIpaShares: [],
        licenseShares: [],
        txHashShares: [],
      });
    }
    const entry = recordMap.get(record._id);
    entry.ownerAddrShares.push(record.owner_address["%share"]);
    entry.projectIdShares.push(record.project_id["%share"]);
    entry.nameShares.push(record.name["%share"]);
    entry.descShares.push(record.desc["%share"]);
    entry.ownersShares.push(record.owners["%share"]);
    entry.imageShares.push(record.image_url["%share"]);
    entry.ipaShares.push(record.ipa["%share"]);
    entry.parentIpaShares.push(record.parent_ipa["%share"]);
    entry.licenseShares.push(record.remix_license_terms["%share"]);
    entry.txHashShares.push(record.register_tx_hash["%share"]);
  });

  const decrypted: StoriesData[] = [];
  for (const [id, shares] of Array.from(recordMap.entries())) {
    if (shares.ownerAddrShares.length === 3) {
      try {
        const [
          owner_address,
          project_id,
          name,
          desc,
          owners,
          image_url,
          ipa,
          parent_ipa,
          remix_license_terms,
          register_tx_hash,
        ] = await Promise.all([
          encryption.decrypt(shares.ownerAddrShares),
          encryption.decrypt(shares.projectIdShares),
          encryption.decrypt(shares.nameShares),
          encryption.decrypt(shares.descShares),
          encryption.decrypt(shares.ownersShares),
          encryption.decrypt(shares.imageShares),
          encryption.decrypt(shares.ipaShares),
          encryption.decrypt(shares.parentIpaShares),
          encryption.decrypt(shares.licenseShares),
          encryption.decrypt(shares.txHashShares),
        ]);
        decrypted.push({
          owner_address,
          project_id,
          name,
          desc,
          owners,
          image_url,
          ipa,
          parent_ipa,
          remix_license_terms,
          register_tx_hash,
        });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return decrypted;
}

export async function fetchStoriesByAddress(
  targetAddress: string
): Promise<StoriesData[]> {
  const allRecords = await fetchStories();
  return allRecords.filter((record) => record.owner_address === targetAddress);
}
