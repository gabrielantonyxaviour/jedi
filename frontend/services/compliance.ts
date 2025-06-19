import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
} from "./base";
import { ComplianceData } from "../types";

export async function pushCompliance(data: ComplianceData): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const recordId = uuidv4();

  const [
    nameShares,
    projectIdShares,
    ownerAddrShares,
    sourceShares,
    dataShares,
  ] = await Promise.all([
    encryption.encrypt(data.name),
    encryption.encrypt(data.project_id),
    encryption.encrypt(data.owner_address),
    encryption.encrypt(data.source),
    encryption.encrypt(data.data),
  ]);

  const payloads = await Promise.all(
    [0, 1, 2].map((index) =>
      uploadToNode(
        index,
        {
          _id: recordId,
          name: { "%share": nameShares[index] },
          project_id: { "%share": projectIdShares[index] },
          owner_address: { "%share": ownerAddrShares[index] },
          source: { "%share": sourceShares[index] },
          data: { "%share": dataShares[index] },
        },
        jwts[index],
        SCHEMA_IDS.COMPLIANCE
      )
    )
  );

  return payloads.every(Boolean);
}

export async function fetchCompliance(): Promise<ComplianceData[]> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);
  const allRecords = await Promise.all(
    [0, 1, 2].map((index) =>
      fetchFromNode(index, jwts[index], SCHEMA_IDS.COMPLIANCE)
    )
  );

  const recordMap = new Map();
  allRecords.flat().forEach((record) => {
    if (!recordMap.has(record.id)) {
      recordMap.set(record.id, {
        nameShares: [],
        projectIdShares: [],
        ownerAddrShares: [],
        sourceShares: [],
        dataShares: [],
      });
    }
    const entry = recordMap.get(record.id);
    entry.nameShares.push(record.name["%share"]);
    entry.projectIdShares.push(record.project_id["%share"]);
    entry.ownerAddrShares.push(record.owner_address["%share"]);
    entry.sourceShares.push(record.source["%share"]);
    entry.dataShares.push(record.data["%share"]);
  });

  const decrypted: ComplianceData[] = [];
  for (const [id, shares] of Array.from(recordMap.entries())) {
    if (shares.nameShares.length === 3) {
      try {
        const [name, project_id, owner_address, source, data] =
          await Promise.all([
            encryption.decrypt(shares.nameShares),
            encryption.decrypt(shares.projectIdShares),
            encryption.decrypt(shares.ownerAddrShares),
            encryption.decrypt(shares.sourceShares),
            encryption.decrypt(shares.dataShares),
          ]);
        decrypted.push({ name, project_id, owner_address, source, data });
      } catch (error) {
        console.error(`Failed to decrypt record ${id}:`, error);
      }
    }
  }
  return decrypted;
}

export async function fetchComplianceByAddress(
  targetAddress: string
): Promise<ComplianceData[]> {
  const allRecords = await fetchCompliance();
  return allRecords.filter((record) => record.owner_address === targetAddress);
}
