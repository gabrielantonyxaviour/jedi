import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
} from "./base";
import { LogsData } from "./types";

export async function pushLogs(data: LogsData): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const recordId = uuidv4();

  const [
    ownerAddrShares,
    projectIdShares,
    agentNameShares,
    textShares,
    dataShares,
  ] = await Promise.all([
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
        ownerAddrShares: [],
        projectIdShares: [],
        agentNameShares: [],
        textShares: [],
        dataShares: [],
      });
    }
    const entry = recordMap.get(record.id);
    entry.ownerAddrShares.push(record.owner_address["%share"]);
    entry.projectIdShares.push(record.project_id["%share"]);
    entry.agentNameShares.push(record.agent_name["%share"]);
    entry.textShares.push(record.text["%share"]);
    entry.dataShares.push(record.data["%share"]);
  });

  const decrypted: LogsData[] = [];
  for (const [id, shares] of Array.from(recordMap.entries())) {
    if (shares.ownerAddrShares.length === 3) {
      try {
        const [owner_address, project_id, agent_name, text, data] =
          await Promise.all([
            encryption.decrypt(shares.ownerAddrShares),
            encryption.decrypt(shares.projectIdShares),
            encryption.decrypt(shares.agentNameShares),
            encryption.decrypt(shares.textShares),
            encryption.decrypt(shares.dataShares),
          ]);
        decrypted.push({ owner_address, project_id, agent_name, text, data });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
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

async function main() {
  const success = await pushLogs({
    owner_address: "0x1234567890abcdef",
    project_id: "proj_123",
    agent_name: "DataAgent",
    text: "Successfully processed user request",
    data: "{'action': 'user_login', 'timestamp': '2024-01-15T10:30:00Z'}",
  });

  console.log(success ? "✓ Logs data pushed" : "✗ Push failed");

  const records = await fetchLogs();
  console.log("Logs records:", records);
}

if (require.main === module) {
  main().catch(console.error);
}
