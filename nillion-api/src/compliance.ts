import { v4 as uuidv4 } from "uuid";
import { SCHEMA_IDS } from "./config";
import {
  generateJWTs,
  createEncryptionService,
  uploadToNode,
  fetchFromNode,
  updateAtNode,
} from "./base";
import { ComplianceData } from "./types";

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

  const results = await Promise.all(
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

  return results.every(Boolean);
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
    if (!recordMap.has(record._id)) {
      recordMap.set(record._id, {
        nameShares: [],
        projectIdShares: [],
        ownerAddrShares: [],
        sourceShares: [],
        dataShares: [],
      });
    }
    const entry = recordMap.get(record._id);
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

async function main() {
  // Create initial record
  const success = await pushCompliance({
    name: "KYC Compliance Check",
    project_id: "proj_123",
    owner_address: "0x1234567890abcdef",
    source: "compliance_system",
    data: "{'status': 'verified', 'timestamp': '2024-01-15T10:30:00Z'}",
  });

  console.log(success ? "✓ Compliance data pushed" : "✗ Push failed");

  // Fetch records to get ID
  const records = await fetchCompliance();
  console.log("Compliance records:", records);

  if (records.length > 0) {
    // Update the first record
    const recordToUpdate = records[0];
    const updateSuccess = await updateCompliance(recordToUpdate._id, {
      name: "Updated KYC Compliance Check",
      data: "{'status': 'updated', 'timestamp': '2024-01-16T11:00:00Z'}",
    });

    console.log(
      updateSuccess ? "✓ Compliance data updated" : "✗ Update failed"
    );

    // Fetch updated records
    const updatedRecords = await fetchCompliance();
    console.log("Updated compliance records:", updatedRecords);
  }
}

export async function updateCompliance(
  recordId: string,
  updates: Partial<ComplianceData>
): Promise<boolean> {
  const [encryption, jwts] = await Promise.all([
    createEncryptionService(),
    generateJWTs(),
  ]);

  // Encrypt only the fields that are being updated
  const encryptedUpdates: any = {};

  if (updates.name !== undefined) {
    const nameShares = await encryption.encrypt(updates.name);
    encryptedUpdates.name = { "%share": nameShares };
  }

  if (updates.project_id !== undefined) {
    const projectIdShares = await encryption.encrypt(updates.project_id);
    encryptedUpdates.project_id = { "%share": projectIdShares };
  }

  if (updates.owner_address !== undefined) {
    const ownerAddrShares = await encryption.encrypt(updates.owner_address);
    encryptedUpdates.owner_address = { "%share": ownerAddrShares };
  }

  if (updates.source !== undefined) {
    const sourceShares = await encryption.encrypt(updates.source);
    encryptedUpdates.source = { "%share": sourceShares };
  }

  if (updates.data !== undefined) {
    const dataShares = await encryption.encrypt(updates.data);
    encryptedUpdates.data = { "%share": dataShares };
  }

  // Update across all nodes
  const results = await Promise.all(
    [0, 1, 2].map((index) => {
      const nodeUpdate: any = {};

      // Build node-specific updates with the correct share index
      Object.keys(encryptedUpdates).forEach((key) => {
        if (encryptedUpdates[key]["%share"]) {
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
        SCHEMA_IDS.COMPLIANCE
      );
    })
  );

  return results.every(Boolean);
}

if (require.main === module) {
  main().catch(console.error);
}
