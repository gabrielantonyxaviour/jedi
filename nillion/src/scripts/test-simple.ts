import { SecretVaultWrapper } from "secretvaults";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { nillionConfig } from "../config/nillion.js";
dotenv.config();

async function testSimple() {
  const vault = new SecretVaultWrapper(
    nillionConfig.nodes,
    nillionConfig.orgCredentials,
    process.env.TEST_SCHEMA_ID!
  );

  await vault.init();

  // Write data
  const data = [{ _id: uuidv4(), name: "test", value: 42 }];
  const result = await vault.writeToNodes(data);
  console.log("Write result:", result);

  // Read data
  const readData = await vault.readFromNodes();
  console.log("Read data:", readData);
}

testSimple().catch(console.error);
