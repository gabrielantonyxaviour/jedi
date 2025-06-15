"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const index_js_1 = require("../services/index.js");
async function testCompliance() {
    console.log("🧪 Testing Compliance Service...\n");
    const complianceService = index_js_1.ServiceFactory.getCompliance();
    try {
        console.log("📝 Creating test compliance records...");
        const recordId1 = await complianceService.createComplianceRecord("GDPR Data Processing Audit", "internal_audit", JSON.stringify({
            regulation: "GDPR",
            region: "EU",
            status: "compliant",
            lastAudit: "2024-05-15",
            riskLevel: "low",
        }));
        const recordId2 = await complianceService.createComplianceRecord("SOX Financial Controls Review", "external_audit", JSON.stringify({
            regulation: "SOX",
            region: "US",
            status: "under_review",
            riskLevel: "medium",
        }));
        console.log(`✅ Created compliance records: ${recordId1}, ${recordId2}\n`);
        // Read compliance records
        console.log("📖 Reading compliance records...");
        const allRecords = await complianceService.findAll();
        console.log(`📊 Total compliance records: ${allRecords.length}`);
        if (allRecords.length > 0) {
            console.log("\n📄 Sample compliance record (encrypted):");
            const record = allRecords[0];
            console.log(`  Name: ${record.name["%share"]}`);
            console.log(`  Source: ${record.source["%share"]}`);
            console.log(`  Data: ${record.data["%share"]}`);
        }
        console.log("\n✅ Compliance service test completed successfully!");
    }
    catch (error) {
        console.error("❌ Compliance service test failed:", error);
        process.exit(1);
    }
}
testCompliance();
