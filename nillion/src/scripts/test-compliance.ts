import dotenv from "dotenv";
dotenv.config();

import { ServiceFactory } from "../services/index.js";

async function testCompliance() {
  console.log("🧪 Testing Compliance Service...\n");

  const complianceService = ServiceFactory.getCompliance();

  try {
    // Create test compliance records
    console.log("📝 Creating test compliance records...");

    const recordId1 = await complianceService.createComplianceRecord(
      "GDPR Data Processing Audit",
      {
        regulation: "GDPR",
        region: "EU",
        status: "compliant",
        lastAudit: "2024-05-15",
        auditBy: "External Compliance Firm",
        findings: ["minor_documentation_gaps", "resolved"],
        nextAudit: "2024-11-15",
        riskLevel: "low",
        dataCategories: ["personal_data", "user_preferences", "analytics"],
        retentionPeriod: "24_months",
      }
    );

    const recordId2 = await complianceService.createComplianceRecord(
      "SOX Financial Controls Review",
      {
        regulation: "SOX",
        region: "US",
        status: "under_review",
        lastAudit: "2024-06-01",
        auditBy: "Internal Audit Team",
        findings: ["pending_review"],
        nextAudit: "2024-12-01",
        riskLevel: "medium",
        controlAreas: [
          "financial_reporting",
          "data_integrity",
          "access_controls",
        ],
        complianceOfficer: "Jane Smith",
      }
    );

    const recordId3 = await complianceService.createComplianceRecord(
      "HIPAA Healthcare Data Security",
      {
        regulation: "HIPAA",
        region: "US",
        status: "compliant",
        lastAudit: "2024-04-20",
        auditBy: "Healthcare Compliance Specialists",
        findings: ["fully_compliant"],
        nextAudit: "2024-10-20",
        riskLevel: "low",
        dataTypes: [
          "patient_records",
          "medical_history",
          "billing_information",
        ],
        encryptionStatus: "AES_256",
        accessLogs: "enabled",
      }
    );

    console.log(
      `✅ Created compliance records: ${recordId1}, ${recordId2}, ${recordId3}\n`
    );

    // Read compliance records
    console.log("📖 Reading compliance records...");
    const allRecords = await complianceService.findAll();
    console.log(`📊 Total compliance records: ${allRecords.length}`);

    // Search records
    const gdprRecords = await complianceService.searchCompliance("GDPR");
    console.log(`🔍 GDPR-related records: ${gdprRecords.length}`);

    const auditRecords = await complianceService.searchCompliance("audit");
    console.log(`📋 Audit-related records: ${auditRecords.length}`);

    // Display sample record
    if (allRecords.length > 0) {
      console.log("\n📄 Sample compliance record:");
      const record = allRecords[0];
      console.log(`  Name: ${record.name}`);
      console.log(`  Regulation: ${record.metadata.regulation}`);
      console.log(`  Status: ${record.metadata.status}`);
      console.log(`  Risk Level: ${record.metadata.riskLevel}`);
      console.log(`  Last Audit: ${record.metadata.lastAudit}`);
      console.log(`  Next Audit: ${record.metadata.nextAudit}`);
      console.log(`  Audit By: ${record.metadata.auditBy}`);

      if (record.metadata.findings) {
        console.log(`  Findings: ${record.metadata.findings.join(", ")}`);
      }
    }

    console.log("\n✅ Compliance service test completed successfully!");
  } catch (error) {
    console.error("❌ Compliance service test failed:", error);
    process.exit(1);
  }
}

testCompliance();
