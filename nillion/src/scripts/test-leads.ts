import dotenv from "dotenv";
dotenv.config();

import { ServiceFactory } from "../services";

async function testLeads() {
  console.log("🧪 Testing Leads Service...\n");

  const leadsService = ServiceFactory.getLeads();

  try {
    // Create test leads
    console.log("📝 Creating test leads...");

    const leadId1 = await leadsService.createLead(
      "TechCorp Solutions",
      "twitter",
      "Enterprise software company interested in AI automation tools",
      {
        contactPerson: "Sarah Johnson",
        email: "sarah.j@techcorp.com",
        company_size: "500-1000",
        industry: "enterprise_software",
        budget_range: "$50k-$100k",
        timeline: "Q3 2024",
        interest_level: "high",
      }
    );

    const leadId2 = await leadsService.createLead(
      "StartupX",
      "linkedin",
      "Early-stage fintech startup looking for blockchain integration",
      {
        contactPerson: "Mike Chen",
        email: "mike@startupx.io",
        company_size: "10-50",
        industry: "fintech",
        budget_range: "$10k-$25k",
        timeline: "Q4 2024",
        interest_level: "medium",
      }
    );

    const leadId3 = await leadsService.createLead(
      "HealthTech Innovations",
      "conference",
      "Healthcare technology company seeking HIPAA-compliant solutions",
      {
        contactPerson: "Dr. Lisa Wang",
        email: "l.wang@healthtech.com",
        company_size: "100-500",
        industry: "healthcare",
        budget_range: "$25k-$75k",
        timeline: "Q1 2025",
        interest_level: "high",
      }
    );

    console.log(`✅ Created leads: ${leadId1}, ${leadId2}, ${leadId3}\n`);

    // Read leads
    console.log("📖 Reading leads...");
    const allLeads = await leadsService.findAll();
    console.log(`📊 Total leads: ${allLeads.length}`);

    const twitterLeads = await leadsService.getLeadsBySource("twitter");
    console.log(`🐦 Twitter leads: ${twitterLeads.length}`);

    const linkedinLeads = await leadsService.getLeadsBySource("linkedin");
    console.log(`💼 LinkedIn leads: ${linkedinLeads.length}`);

    // Search leads
    const techLeads = await leadsService.searchLeads("tech");
    console.log(`🔍 Tech-related leads: ${techLeads.length}`);

    // Display sample lead
    if (allLeads.length > 0) {
      console.log("\n📄 Sample lead:");
      const lead = allLeads[0];
      console.log(`  Name: ${lead.name}`);
      console.log(`  Source: ${lead.source}`);
      console.log(`  Contact: ${lead.metadata.contactPerson}`);
      console.log(`  Industry: ${lead.metadata.industry}`);
      console.log(`  Budget: ${lead.metadata.budget_range}`);
      console.log(`  Interest Level: ${lead.metadata.interest_level}`);
    }

    console.log("\n✅ Leads service test completed successfully!");
  } catch (error) {
    console.error("❌ Leads service test failed:", error);
    process.exit(1);
  }
}

testLeads();
