import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
  updateAtNode,
} from "./base";
import { SocialsData } from "../../types/nillion";

export async function pushSocials(data: SocialsData): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const recordId = uuidv4();

  const [
    ownerAddrShares,
    projectIdShares,
    twitterNameShares,
    twitterEmailShares,
    twitterPasswordShares,
    telegramUsernameShares,
    telegramBotTokenShares,
    twitterActionsShares,
    telegramActionsShares,
  ] = await Promise.all([
    encryption.encrypt(data.owner_address),
    encryption.encrypt(data.project_id),
    encryption.encrypt(data.twitter.name),
    encryption.encrypt(data.twitter.email),
    encryption.encrypt(data.twitter.password),
    encryption.encrypt(data.telegram.username),
    encryption.encrypt(data.telegram.bot_token),
    encryption.encrypt(JSON.stringify(data.twitter_actions)),
    encryption.encrypt(JSON.stringify(data.telegram_actions)),
  ]);

  const results = await Promise.all(
    [0, 1, 2].map((index) =>
      uploadToNode(
        index,
        {
          _id: recordId,
          owner_address: { "%share": ownerAddrShares[index] },
          project_id: { "%share": projectIdShares[index] },
          twitter: {
            name: { "%share": twitterNameShares[index] },
            email: { "%share": twitterEmailShares[index] },
            password: { "%share": twitterPasswordShares[index] },
          },
          telegram: {
            username: { "%share": telegramUsernameShares[index] },
            bot_token: { "%share": telegramBotTokenShares[index] },
          },
          twitter_actions: [
            {
              id: { "%share": twitterActionsShares[index] },
              action: { "%share": twitterActionsShares[index] },
              ref_id: { "%share": twitterActionsShares[index] },
              text: { "%share": twitterActionsShares[index] },
            },
          ],
          telegram_actions: [
            {
              id: { "%share": telegramActionsShares[index] },
              text: { "%share": telegramActionsShares[index] },
              ref_user_id: { "%share": telegramActionsShares[index] },
            },
          ],
        },
        jwts[index],
        SCHEMA_IDS.SOCIALS
      )
    )
  );

  return results.every(Boolean);
}

export async function updateSocials(
  recordId: string,
  updates: Partial<SocialsData>
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

  if (updates.twitter !== undefined) {
    const twitterNameShares = await encryption.encrypt(updates.twitter.name);
    const twitterEmailShares = await encryption.encrypt(updates.twitter.email);
    const twitterPasswordShares = await encryption.encrypt(
      updates.twitter.password
    );

    encryptedUpdates.twitter = {
      name: { "%share": twitterNameShares },
      email: { "%share": twitterEmailShares },
      password: { "%share": twitterPasswordShares },
    };
  }

  if (updates.telegram !== undefined) {
    const telegramUsernameShares = await encryption.encrypt(
      updates.telegram.username
    );
    const telegramBotTokenShares = await encryption.encrypt(
      updates.telegram.bot_token
    );

    encryptedUpdates.telegram = {
      username: { "%share": telegramUsernameShares },
      bot_token: { "%share": telegramBotTokenShares },
    };
  }

  if (updates.twitter_actions !== undefined) {
    const twitterActionsShares = await encryption.encrypt(
      JSON.stringify(updates.twitter_actions)
    );
    encryptedUpdates.twitter_actions = [
      {
        id: { "%share": twitterActionsShares },
        action: { "%share": twitterActionsShares },
        ref_id: { "%share": twitterActionsShares },
        text: { "%share": twitterActionsShares },
      },
    ];
  }

  if (updates.telegram_actions !== undefined) {
    const telegramActionsShares = await encryption.encrypt(
      JSON.stringify(updates.telegram_actions)
    );
    encryptedUpdates.telegram_actions = [
      {
        id: { "%share": telegramActionsShares },
        text: { "%share": telegramActionsShares },
        ref_user_id: { "%share": telegramActionsShares },
      },
    ];
  }

  const results = await Promise.all(
    [0, 1, 2].map((index) => {
      const nodeUpdate: any = {};

      Object.keys(encryptedUpdates).forEach((key) => {
        if (key === "twitter" || key === "telegram") {
          nodeUpdate[key] = {};
          Object.keys(encryptedUpdates[key]).forEach((subKey) => {
            nodeUpdate[key][subKey] = {
              "%share": encryptedUpdates[key][subKey]["%share"][index],
            };
          });
        } else if (key === "twitter_actions" || key === "telegram_actions") {
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
        SCHEMA_IDS.SOCIALS
      );
    })
  );

  return results.every(Boolean);
}

export async function fetchSocials(): Promise<SocialsData[]> {
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
    if (!recordMap.has(record.id)) {
      recordMap.set(record.id, {
        ownerAddrShares: [],
        projectIdShares: [],
        twitterNameShares: [],
        twitterEmailShares: [],
        twitterPasswordShares: [],
        telegramUsernameShares: [],
        telegramBotTokenShares: [],
        twitterActionsShares: [],
        telegramActionsShares: [],
      });
    }
    const entry = recordMap.get(record.id);
    entry.ownerAddrShares.push(record.owner_address["%share"]);
    entry.projectIdShares.push(record.project_id["%share"]);
    entry.twitterNameShares.push(record.twitter.name["%share"]);
    entry.twitterEmailShares.push(record.twitter.email["%share"]);
    entry.twitterPasswordShares.push(record.twitter.password["%share"]);
    entry.telegramUsernameShares.push(record.telegram.username["%share"]);
    entry.telegramBotTokenShares.push(record.telegram.bot_token["%share"]);
    entry.twitterActionsShares.push(record.twitter_actions[0].id["%share"]);
    entry.telegramActionsShares.push(record.telegram_actions[0].id["%share"]);
  });

  const decrypted: SocialsData[] = [];
  for (const [id, shares] of Array.from(recordMap.entries())) {
    if (shares.ownerAddrShares.length === 3) {
      try {
        const [
          owner_address,
          project_id,
          twitterName,
          twitterEmail,
          twitterPassword,
          telegramUsername,
          telegramBotToken,
          twitterActionsStr,
          telegramActionsStr,
        ] = await Promise.all([
          encryption.decrypt(shares.ownerAddrShares),
          encryption.decrypt(shares.projectIdShares),
          encryption.decrypt(shares.twitterNameShares),
          encryption.decrypt(shares.twitterEmailShares),
          encryption.decrypt(shares.twitterPasswordShares),
          encryption.decrypt(shares.telegramUsernameShares),
          encryption.decrypt(shares.telegramBotTokenShares),
          encryption.decrypt(shares.twitterActionsShares),
          encryption.decrypt(shares.telegramActionsShares),
        ]);

        decrypted.push({
          owner_address,
          project_id,
          twitter: {
            name: twitterName,
            email: twitterEmail,
            password: twitterPassword,
          },
          telegram: {
            username: telegramUsername,
            bot_token: telegramBotToken,
          },
          twitter_actions: JSON.parse(twitterActionsStr),
          telegram_actions: JSON.parse(telegramActionsStr),
        });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return decrypted;
}

export async function fetchSocialsByAddress(
  targetAddress: string
): Promise<SocialsData[]> {
  const allRecords = await fetchSocials();
  return allRecords.filter((record) => record.owner_address === targetAddress);
}
