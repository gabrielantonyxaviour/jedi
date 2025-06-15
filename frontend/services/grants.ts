import { SCHEMA_IDS } from "@/lib/nilion";
import { generateJWTs, createEncryptionService, fetchFromNode } from "./base";
import { GrantsData } from "@/lib/types";

export async function fetchGrantsByProjectId(
  projectId: string
): Promise<GrantsData[]> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const allRecords = await Promise.all(
    [0, 1, 2].map((index) =>
      fetchFromNode(index, jwts[index], SCHEMA_IDS.GRANTS)
    )
  );

  const recordMap = new Map();
  allRecords.flat().forEach((record) => {
    if (!recordMap.has(record.id)) {
      recordMap.set(record.id, {
        projectIdShares: [],
        nameShares: [],
        descShares: [],
        linksShares: [],
        imageUrlShares: [],
        ownerAddrShares: [],
        membersShares: [],
        userEmailShares: [],
        userNameShares: [],
        grantsShares: [],
        milestonesShares: [],
      });
    }
    const entry = recordMap.get(record.id);
    entry.projectIdShares.push(record.project_id["%share"]);
    entry.nameShares.push(record.name["%share"]);
    entry.descShares.push(record.desc["%share"]);
    entry.linksShares.push(record.links["%share"]);
    entry.imageUrlShares.push(record.image_url["%share"]);
    entry.ownerAddrShares.push(record.owner_address["%share"]);
    entry.membersShares.push(record.members["%share"]);
    entry.userEmailShares.push(record.user_email["%share"]);
    entry.userNameShares.push(record.user_name["%share"]);
    entry.grantsShares.push(record.grants["%share"]);
    entry.milestonesShares.push(record.milestones["%share"]);
  });

  const decrypted: GrantsData[] = [];
  for (const [id, shares] of recordMap.entries()) {
    if (shares.projectIdShares.length === 3) {
      try {
        const [
          project_id,
          name,
          desc,
          links,
          image_url,
          owner_address,
          members,
          user_email,
          user_name,
          grants,
          milestones,
        ] = await Promise.all([
          encryption.decrypt(shares.projectIdShares),
          encryption.decrypt(shares.nameShares),
          encryption.decrypt(shares.descShares),
          encryption.decrypt(shares.linksShares),
          encryption.decrypt(shares.imageUrlShares),
          encryption.decrypt(shares.ownerAddrShares),
          encryption.decrypt(shares.membersShares),
          encryption.decrypt(shares.userEmailShares),
          encryption.decrypt(shares.userNameShares),
          encryption.decrypt(shares.grantsShares),
          encryption.decrypt(shares.milestonesShares),
        ]);
        decrypted.push({
          project_id,
          name,
          desc,
          links,
          image_url,
          owner_address,
          members,
          user_email,
          user_name,
          grants: JSON.parse(grants),
          milestones: JSON.parse(milestones),
        });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return decrypted.filter((record) => record.project_id === projectId);
}
