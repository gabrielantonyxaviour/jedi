import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
  updateAtNode,
} from "./base";
import { GrantsData } from "../../types/nillion";

export async function pushGrants(data: GrantsData): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const recordId = uuidv4();

  const [
    projectIdShares,
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
    encryption.encrypt(data.project_id),
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
          project_id: { "%share": projectIdShares[index] },
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

export async function updateGrants(
  recordId: string,
  updates: Partial<GrantsData>
): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);

  const encryptedUpdates: any = {};

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

  if (updates.links !== undefined) {
    const linksShares = await encryption.encrypt(updates.links);
    encryptedUpdates.links = { "%share": linksShares };
  }

  if (updates.image_url !== undefined) {
    const imageShares = await encryption.encrypt(updates.image_url);
    encryptedUpdates.image_url = { "%share": imageShares };
  }

  if (updates.owner_address !== undefined) {
    const ownerAddrShares = await encryption.encrypt(updates.owner_address);
    encryptedUpdates.owner_address = { "%share": ownerAddrShares };
  }

  if (updates.members !== undefined) {
    const membersShares = await encryption.encrypt(updates.members);
    encryptedUpdates.members = { "%share": membersShares };
  }

  if (updates.user_email !== undefined) {
    const userEmailShares = await encryption.encrypt(updates.user_email);
    encryptedUpdates.user_email = { "%share": userEmailShares };
  }

  if (updates.user_name !== undefined) {
    const userNameShares = await encryption.encrypt(updates.user_name);
    encryptedUpdates.user_name = { "%share": userNameShares };
  }

  if (updates.grants !== undefined) {
    const grantsShares = await encryption.encrypt(
      JSON.stringify(updates.grants)
    );
    encryptedUpdates.grants = [
      {
        id: { "%share": grantsShares },
        name: { "%share": grantsShares },
        desc: { "%share": grantsShares },
        applied_at: { "%share": grantsShares },
      },
    ];
  }

  if (updates.milestones !== undefined) {
    const milestonesShares = await encryption.encrypt(
      JSON.stringify(updates.milestones)
    );
    encryptedUpdates.milestones = [
      {
        id: { "%share": milestonesShares },
        grant_id: { "%share": milestonesShares },
        name: { "%share": milestonesShares },
        desc: { "%share": milestonesShares },
        created_at: { "%share": milestonesShares },
      },
    ];
  }

  const results = await Promise.all(
    [0, 1, 2].map((index) => {
      const nodeUpdate: any = {};
      Object.keys(encryptedUpdates).forEach((key) => {
        if (key === "grants" || key === "milestones") {
          nodeUpdate[key] = encryptedUpdates[key].map((item: any) => {
            const updatedItem: any = {};
            Object.keys(item).forEach((subKey) => {
              updatedItem[subKey] = { "%share": item[subKey]["%share"][index] };
            });
            return updatedItem;
          });
        } else {
          nodeUpdate[key] = {
            "%share": encryptedUpdates[key]["%share"][index],
          };
        }
      });

      return updateAtNode(
        index,
        recordId,
        nodeUpdate,
        jwts[index],
        SCHEMA_IDS.GRANTS
      );
    })
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
    if (!recordMap.has(record.id)) {
      recordMap.set(record.id, {
        projectIdShares: [],
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
    const entry = recordMap.get(record.id);
    entry.projectIdShares.push(record.project_id["%share"]);
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
          grantsStr,
          milestonesStr,
        ] = await Promise.all([
          encryption.decrypt(shares.projectIdShares),
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
          project_id,
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

export async function fetchGrantsByAddress(
  targetAddress: string
): Promise<GrantsData[]> {
  const allRecords = await fetchGrants();
  return allRecords.filter((record) => record.owner_address === targetAddress);
}
