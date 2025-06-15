"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
async function setupSchemas() {
    console.log("🔧 Setting up Nillion SecretVault schemas...\n");
    const schemas = [
        { name: "logs", file: "logs.json", envVar: "LOGS_SCHEMA_ID" },
        { name: "github", file: "github.json", envVar: "GITHUB_SCHEMA_ID" },
        { name: "leads", file: "leads.json", envVar: "LEADS_SCHEMA_ID" },
        { name: "stories", file: "stories.json", envVar: "STORIES_SCHEMA_ID" },
        { name: "socials", file: "socials.json", envVar: "SOCIALS_SCHEMA_ID" },
        { name: "grants", file: "grants.json", envVar: "GRANTS_SCHEMA_ID" },
        {
            name: "compliance",
            file: "compliance.json",
            envVar: "COMPLIANCE_SCHEMA_ID",
        },
    ];
    console.log("📋 Schema IDs to add to your .env file:\n");
    for (const schema of schemas) {
        const schemaId = (0, uuid_1.v4)();
        console.log(`${schema.envVar}=${schemaId}`);
        // Load schema file
        const schemaPath = new URL(`../schemas/${schema.file}`, import.meta.url)
            .pathname;
        if (fs_1.default.existsSync(schemaPath)) {
            const schemaContent = JSON.parse(fs_1.default.readFileSync(schemaPath, "utf8"));
            console.log(`\n📝 Creating ${schema.name} collection with schema ID: ${schemaId}`);
            console.log(`   Schema file: ${schema.file}`);
            console.log(`   Title: ${schemaContent.title}`);
            // Here you would make the API call to create the schema
            // For now, we just show what needs to be done
            console.log(`   ⚠️  Manual step required: Create this schema in SecretVault using the Schema Tools`);
            console.log(`   🔗 Schema Tools: https://schema-tools.vercel.app/`);
        }
    }
    console.log("\n📋 Instructions:");
    console.log("1. Copy the schema IDs above to your .env file");
    console.log("2. Visit https://schema-tools.vercel.app/");
    console.log("3. Upload each schema file from src/schemas/ directory");
    console.log("4. Use the corresponding schema ID for each collection");
    console.log("5. Ensure all schemas are created before running tests");
    console.log("\n✅ Schema setup guide completed!");
}
setupSchemas();
