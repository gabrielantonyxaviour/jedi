import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
  updateAtNode,
} from "./base";
import { LogsData } from "../../types/nillion";

export async function pushLogs(data: LogsData): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const recordId = uuidv4();

  const [
    idShares,
    ownerAddrShares,
    projectIdShares,
    agentNameShares,
    textShares,
    dataShares,
  ] = await Promise.all([
    encryption.encrypt(data.id),
    encryption.encrypt(data.owner_address),
    encryption.encrypt(data.project_id),
    encryption.encrypt(data.agent_name),
    encryption.encrypt(data.text),
    encryption.encrypt(data.data),
  ]);

  const results = await Promise.all(
    [0, 1, 2].map((index) =>
      uploadToNode(
        index,
        {
          _id: recordId,
          id: { "%share": idShares[index] },
          owner_address: { "%share": ownerAddrShares[index] },
          project_id: { "%share": projectIdShares[index] },
          agent_name: { "%share": agentNameShares[index] },
          text: { "%share": textShares[index] },
          data: { "%share": dataShares[index] },
        },
        jwts[index],
        SCHEMA_IDS.LOGS
      )
    )
  );

  return results.every(Boolean);
}

export async function updateLogs(
  recordId: string,
  updates: Partial<LogsData>
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

  if (updates.agent_name !== undefined) {
    const agentNameShares = await encryption.encrypt(updates.agent_name);
    encryptedUpdates.agent_name = { "%share": agentNameShares };
  }

  if (updates.id !== undefined) {
    const idShares = await encryption.encrypt(updates.id);
    encryptedUpdates.id = { "%share": idShares };
  }

  if (updates.text !== undefined) {
    const textShares = await encryption.encrypt(updates.text);
    encryptedUpdates.text = { "%share": textShares };
  }

  if (updates.data !== undefined) {
    const dataShares = await encryption.encrypt(updates.data);
    encryptedUpdates.data = { "%share": dataShares };
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
        SCHEMA_IDS.LOGS
      );
    })
  );

  return results.every(Boolean);
}

export async function fetchLogs(): Promise<LogsData[]> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const allRecords = await Promise.all(
    [0, 1, 2].map((index) => fetchFromNode(index, jwts[index], SCHEMA_IDS.LOGS))
  );

  const recordMap = new Map();
  allRecords.flat().forEach((record) => {
    if (!recordMap.has(record.id)) {
      recordMap.set(record.id, {
        idShares: [],
        ownerAddrShares: [],
        projectIdShares: [],
        agentNameShares: [],
        textShares: [],
        dataShares: [],
      });
    }
    const entry = recordMap.get(record.id);
    entry.idShares.push(record.id["%share"]);
    entry.ownerAddrShares.push(record.owner_address["%share"]);
    entry.projectIdShares.push(record.project_id["%share"]);
    entry.agentNameShares.push(record.agent_name["%share"]);
    entry.textShares.push(record.text["%share"]);
    entry.dataShares.push(record.data["%share"]);
  });

  const decrypted: LogsData[] = [];
  for (const [num_id, shares] of Array.from(recordMap.entries())) {
    if (shares.ownerAddrShares.length === 3) {
      try {
        const [id, owner_address, project_id, agent_name, text, data] =
          await Promise.all([
            encryption.decrypt(shares.idShares),
            encryption.decrypt(shares.ownerAddrShares),
            encryption.decrypt(shares.projectIdShares),
            encryption.decrypt(shares.agentNameShares),
            encryption.decrypt(shares.textShares),
            encryption.decrypt(shares.dataShares),
          ]);
        decrypted.push({
          id,
          owner_address,
          project_id,
          agent_name,
          text,
          data,
        });
      } catch (error) {
        console.error(`Failed to decrypt record ${num_id}:`, error);
      }
    }
  }
  return decrypted;
}

export async function fetchLogsByAddress(
  targetAddress: string
): Promise<LogsData[]> {
  const allRecords = await fetchLogs();
  return allRecords.filter((record) => record.owner_address === targetAddress);
}
