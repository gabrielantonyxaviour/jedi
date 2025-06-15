"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const secretvaults_1 = require("secretvaults");
const uuid_1 = require("uuid");
const dotenv_1 = __importDefault(require("dotenv"));
const nillion_js_1 = require("../config/nillion.js");
dotenv_1.default.config();
async function testSimple() {
    const vault = new secretvaults_1.SecretVaultWrapper(nillion_js_1.nillionConfig.nodes, nillion_js_1.nillionConfig.orgCredentials, process.env.TEST_SCHEMA_ID);
    await vault.init();
    // Write data
    const data = [{ _id: (0, uuid_1.v4)(), name: "test", value: 42 }];
    const result = await vault.writeToNodes(data);
    console.log("Write result:", result);
    // Read data
    const readData = await vault.readFromNodes();
    console.log("Read data:", readData);
}
testSimple().catch(console.error);
