import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
} from "./base";
import { GrantsData } from "./types";

export async function pushGrants(data: GrantsData): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const recordId = uuidv4();

  const [
    nameShares,
    descShares,
    linksShares,
    imageShares,
    ownerAddrShares,
    membersShares,
    userEmailShares,
    userNameShares,
    grantsShares,
    milestonesShares,
  ] = await Promise.all([
    encryption.encrypt(data.name),
    encryption.encrypt(data.desc),
    encryption.encrypt(data.links),
    encryption.encrypt(data.image_url),
    encryption.encrypt(data.owner_address),
    encryption.encrypt(data.members),
    encryption.encrypt(data.user_email),
    encryption.encrypt(data.user_name),
    encryption.encrypt(JSON.stringify(data.grants)),
    encryption.encrypt(JSON.stringify(data.milestones)),
  ]);

  const results = await Promise.all(
    [0, 1, 2].map((index) =>
      uploadToNode(
        index,
        {
          _id: recordId,
          name: { "%share": nameShares[index] },
          desc: { "%share": descShares[index] },
          links: { "%share": linksShares[index] },
          image_url: { "%share": imageShares[index] },
          owner_address: { "%share": ownerAddrShares[index] },
          members: { "%share": membersShares[index] },
          user_email: { "%share": userEmailShares[index] },
          user_name: { "%share": userNameShares[index] },
          grants: [
            {
              // Store as single encrypted JSON item
              id: { "%share": grantsShares[index] },
              name: { "%share": grantsShares[index] },
              desc: { "%share": grantsShares[index] },
              applied_at: { "%share": grantsShares[index] },
            },
          ],
          milestones: [
            {
              id: { "%share": milestonesShares[index] },
              grant_id: { "%share": milestonesShares[index] },
              name: { "%share": milestonesShares[index] },
              desc: { "%share": milestonesShares[index] },
              created_at: { "%share": milestonesShares[index] },
            },
          ],
        },
        jwts[index],
        SCHEMA_IDS.GRANTS
      )
    )
  );

  return results.every(Boolean);
}

export async function fetchGrants(): Promise<GrantsData[]> {
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
    if (!recordMap.has(record._id)) {
      recordMap.set(record._id, {
        nameShares: [],
        descShares: [],
        linksShares: [],
        imageShares: [],
        ownerAddrShares: [],
        membersShares: [],
        userEmailShares: [],
        userNameShares: [],
        grantsShares: [],
        milestonesShares: [],
      });
    }
    const entry = recordMap.get(record._id);
    entry.nameShares.push(record.name["%share"]);
    entry.descShares.push(record.desc["%share"]);
    entry.linksShares.push(record.links["%share"]);
    entry.imageShares.push(record.image_url["%share"]);
    entry.ownerAddrShares.push(record.owner_address["%share"]);
    entry.membersShares.push(record.members["%share"]);
    entry.userEmailShares.push(record.user_email["%share"]);
    entry.userNameShares.push(record.user_name["%share"]);
    entry.grantsShares.push(record.grants[0].id["%share"]);
    entry.milestonesShares.push(record.milestones[0].id["%share"]);
  });

  const decrypted: GrantsData[] = [];
  for (const [id, shares] of Array.from(recordMap.entries())) {
    if (shares.nameShares.length === 3) {
      try {
        const [
          name,
          desc,
          links,
          image_url,
          owner_address,
          members,
          user_email,
          user_name,
          grantsStr,
          milestonesStr,
        ] = await Promise.all([
          encryption.decrypt(shares.nameShares),
          encryption.decrypt(shares.descShares),
          encryption.decrypt(shares.linksShares),
          encryption.decrypt(shares.imageShares),
          encryption.decrypt(shares.ownerAddrShares),
          encryption.decrypt(shares.membersShares),
          encryption.decrypt(shares.userEmailShares),
          encryption.decrypt(shares.userNameShares),
          encryption.decrypt(shares.grantsShares),
          encryption.decrypt(shares.milestonesShares),
        ]);

        decrypted.push({
          name,
          desc,
          links,
          image_url,
          owner_address,
          members,
          user_email,
          user_name,
          grants: JSON.parse(grantsStr),
          milestones: JSON.parse(milestonesStr),
        });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return decrypted;
}

async function main() {
  const success = await pushGrants({
    name: "Blockchain Innovation Grant",
    desc: "Grant for developing innovative blockchain solutions",
    links: "https://example.com/grant-info",
    image_url: "https://example.com/grant-logo.png",
    owner_address: "0x123456789abcdef",
    members: "team@blockchain.com",
    user_email: "applicant@example.com",
    user_name: "John Developer",
    grants: [
      {
        id: "grant_1",
        name: "Phase 1 Grant",
        desc: "Initial development phase",
        applied_at: "2024-01-15",
      },
    ],
    milestones: [
      {
        id: "milestone_1",
        grant_id: "grant_1",
        name: "MVP Development",
        desc: "Build minimum viable product",
        created_at: "2024-01-20",
      },
    ],
  });

  console.log(success ? "✓ Grants data pushed" : "✗ Push failed");

  const records = await fetchGrants();
  console.log("Grants records:", records);
}

if (require.main === module) {
  main().catch(console.error);
}
