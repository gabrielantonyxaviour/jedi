import { SCHEMA_IDS } from "@/lib/nilion";
import { generateJWTs, createEncryptionService, fetchFromNode } from "./base";
import { SocialsData } from "@/lib/types";

export async function fetchSocialsByProjectId(
  projectId: string
): Promise<SocialsData[]> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const allRecords = await Promise.all(
    [0, 1, 2].map((index) =>
      fetchFromNode(index, jwts[index], SCHEMA_IDS.SOCIALS)
    )
  );

  const recordMap = new Map();
  allRecords.flat().forEach((record) => {
    if (!recordMap.has(record._id)) {
      recordMap.set(record._id, {
        ownerAddrShares: [],
        projectIdShares: [],
        twitterShares: [],
        telegramShares: [],
        twitterActionsShares: [],
        telegramActionsShares: [],
      });
    }
    const entry = recordMap.get(record._id);
    entry.ownerAddrShares.push(record.owner_address["%share"]);
    entry.projectIdShares.push(record.project_id["%share"]);
    entry.twitterShares.push(record.twitter["%share"]);
    entry.telegramShares.push(record.telegram["%share"]);
    entry.twitterActionsShares.push(record.twitter_actions["%share"]);
    entry.telegramActionsShares.push(record.telegram_actions["%share"]);
  });

  const decrypted: SocialsData[] = [];
  for (const [id, shares] of recordMap.entries()) {
    if (shares.projectIdShares.length === 3) {
      try {
        const [
          owner_address,
          project_id,
          twitter,
          telegram,
          twitter_actions,
          telegram_actions,
        ] = await Promise.all([
          encryption.decrypt(shares.ownerAddrShares),
          encryption.decrypt(shares.projectIdShares),
          encryption.decrypt(shares.twitterShares),
          encryption.decrypt(shares.telegramShares),
          encryption.decrypt(shares.twitterActionsShares),
          encryption.decrypt(shares.telegramActionsShares),
        ]);
        decrypted.push({
          owner_address,
          project_id,
          twitter: JSON.parse(twitter),
          telegram: JSON.parse(telegram),
          twitter_actions: JSON.parse(twitter_actions),
          telegram_actions: JSON.parse(telegram_actions),
        });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return decrypted.filter((record) => record.project_id === projectId);
}
