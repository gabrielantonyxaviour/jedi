import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
} from "./base";
import { StoriesData } from "./types";

export async function pushStories(data: StoriesData): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const recordId = uuidv4();

  const [
    nameShares,
    descShares,
    ownersShares,
    imageShares,
    ipaShares,
    parentIpaShares,
    licenseShares,
    txHashShares,
  ] = await Promise.all([
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
    if (shares.nameShares.length === 3) {
      try {
        const [
          name,
          desc,
          owners,
          image_url,
          ipa,
          parent_ipa,
          remix_license_terms,
          register_tx_hash,
        ] = await Promise.all([
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

async function main() {
  const success = await pushStories({
    name: "Epic Adventure Story",
    desc: "A thrilling tale of heroic adventures",
    owners: "author123",
    image_url: "https://example.com/story-cover.jpg",
    ipa: "ipa_address_123",
    parent_ipa: "parent_ipa_456",
    remix_license_terms: "CC BY-SA 4.0",
    register_tx_hash: "0xabcdef123456",
  });

  console.log(success ? "✓ Stories data pushed" : "✗ Push failed");

  const records = await fetchStories();
  console.log("Stories records:", records);
}

if (require.main === module) {
  main().catch(console.error);
}
