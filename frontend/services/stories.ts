import { SCHEMA_IDS } from "@/lib/nilion";
import { generateJWTs, createEncryptionService, fetchFromNode } from "./base";
import { StoriesData } from "@/lib/types";

export async function fetchStoriesByProjectId(
  projectId: string
): Promise<StoriesData[]> {
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
        imageUrlShares: [],
        ipaShares: [],
        parentIpaShares: [],
        remixLicenseTermsShares: [],
        registerTxHashShares: [],
      });
    }
    const entry = recordMap.get(record._id);
    entry.ownerAddrShares.push(record.owner_address["%share"]);
    entry.projectIdShares.push(record.project_id["%share"]);
    entry.nameShares.push(record.name["%share"]);
    entry.descShares.push(record.desc["%share"]);
    entry.ownersShares.push(record.owners["%share"]);
    entry.imageUrlShares.push(record.image_url["%share"]);
    entry.ipaShares.push(record.ipa["%share"]);
    entry.parentIpaShares.push(record.parent_ipa["%share"]);
    entry.remixLicenseTermsShares.push(record.remix_license_terms["%share"]);
    entry.registerTxHashShares.push(record.register_tx_hash["%share"]);
  });

  const decrypted: StoriesData[] = [];
  for (const [id, shares] of recordMap.entries()) {
    if (shares.projectIdShares.length === 3) {
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
          encryption.decrypt(shares.imageUrlShares),
          encryption.decrypt(shares.ipaShares),
          encryption.decrypt(shares.parentIpaShares),
          encryption.decrypt(shares.remixLicenseTermsShares),
          encryption.decrypt(shares.registerTxHashShares),
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
  return decrypted.filter((record) => record.project_id === projectId);
}
