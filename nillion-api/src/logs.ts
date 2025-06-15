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

  const [projectIdShares, agentNameShares, textShares, dataShares] =
    await Promise.all([
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
    if (!recordMap.has(record._id)) {
      recordMap.set(record._id, {
        projectIdShares: [],
        agentNameShares: [],
        textShares: [],
        dataShares: [],
      });
    }
    const entry = recordMap.get(record._id);
    entry.projectIdShares.push(record.project_id["%share"]);
    entry.agentNameShares.push(record.agent_name["%share"]);
    entry.textShares.push(record.text["%share"]);
    entry.dataShares.push(record.data["%share"]);
  });

  const decrypted: LogsData[] = [];
  for (const [id, shares] of Array.from(recordMap.entries())) {
    if (shares.projectIdShares.length === 3) {
      try {
        const [project_id, agent_name, text, data] = await Promise.all([
          encryption.decrypt(shares.projectIdShares),
          encryption.decrypt(shares.agentNameShares),
          encryption.decrypt(shares.textShares),
          encryption.decrypt(shares.dataShares),
        ]);
        decrypted.push({ project_id, agent_name, text, data });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return decrypted;
}

async function main() {
  const success = await pushLogs({
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
