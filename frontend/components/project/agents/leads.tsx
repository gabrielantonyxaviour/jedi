"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { getAgentDisplayName } from "@/utils/agentUtils";

interface LeadsAgentProps {
  userSide: "light" | "dark" | null;
}

const extractValue = (obj: { "%share": string }) => obj["%share"];

export default function LeadsAgent({ userSide }: LeadsAgentProps) {
  const [activeTab, setActiveTab] = useState("pipeline");
  const agentId = "leads";

  // Mock data matching schema
  const leadsData = [
    {
      _id: "lead-001",
      name: { "%share": "TechCorp Inc" },
      source: { "%share": "GitHub" },
      desc: {
        "%share": "Enterprise company interested in AI development tools",
      },
      metadata: {
        "%share": JSON.stringify({
          stage: "Qualified",
          score: 85,
          value: 15000,
          contact: "john@techcorp.com",
          industry: "Technology",
        }),
      },
    },
    {
      _id: "lead-002",
      name: { "%share": "StartupXYZ" },
      source: { "%share": "LinkedIn" },
      desc: {
        "%share": "Early-stage startup looking for development assistance",
      },
      metadata: {
        "%share": JSON.stringify({
          stage: "Proposal",
          score: 72,
          value: 8000,
          contact: "founder@startupxyz.com",
          industry: "Fintech",
        }),
      },
    },
    {
      _id: "lead-003",
      name: { "%share": "Enterprise Co" },
      source: { "%share": "Website" },
      desc: { "%share": "Large enterprise seeking AI integration solutions" },
      metadata: {
        "%share": JSON.stringify({
          stage: "Discovery",
          score: 90,
          value: 25000,
          contact: "cto@enterprise.com",
          industry: "Manufacturing",
        }),
      },
    },
  ];

  // Transform data for UI
  const pipeline = leadsData.map((lead) => {
    const metadata = JSON.parse(extractValue(lead.metadata));
    return {
      name: extractValue(lead.name),
      stage: metadata.stage,
      score: metadata.score,
      value: `$${(metadata.value / 1000).toFixed(0)}K`,
      source: extractValue(lead.source),
      description: extractValue(lead.desc),
    };
  });

  const sources = leadsData.reduce((acc: any[], lead) => {
    const source = extractValue(lead.source);
    const existing = acc.find((s) => s.name === source);
    if (existing) {
      existing.leads += 1;
    } else {
      acc.push({
        name: source,
        leads: 1,
        conversion:
          source === "Website" ? "15%" : source === "GitHub" ? "12%" : "8%",
      });
    }
    return acc;
  }, []);

  const metrics = {
    totalLeads: leadsData.length,
    qualified: pipeline.filter((p) => p.stage === "Qualified").length,
    converted: 0, // Would be calculated from actual data
    revenue: pipeline.reduce((sum, lead) => {
      const value = parseInt(lead.value.replace(/[$K]/g, "")) * 1000;
      return sum + value;
    }, 0),
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-stone-700">
        <div className="flex items-center space-x-2">
          <img
            src={`/agents/${userSide}/${agentId}.png`}
            alt=""
            className="w-9 h-9"
          />
          <span className="font-medium text-white">
            {getAgentDisplayName(agentId, userSide)}
          </span>
        </div>
      </div>

      <div className="flex border-b border-stone-700">
        {["pipeline", "sources", "outreach"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize ${
              activeTab === tab
                ? userSide === "light"
                  ? "border-b-2 border-blue-500 text-blue-400"
                  : "border-b-2 border-red-500 text-red-400"
                : "text-stone-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-stone-800/50 rounded-lg p-3">
                <div className="text-white font-medium text-lg">
                  {metrics.totalLeads}
                </div>
                <div className="text-xs text-stone-400">Total Leads</div>
              </div>
              <div className="bg-stone-800/50 rounded-lg p-3">
                <div className="text-green-400 font-medium text-lg">
                  ${(metrics.revenue / 1000).toFixed(0)}K
                </div>
                <div className="text-xs text-stone-400">Pipeline Value</div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-medium">Active Pipeline</h3>
              {pipeline.map((lead, index) => (
                <div key={index} className="bg-stone-800/50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-white font-medium">{lead.name}</div>
                      <div className="text-sm text-stone-400">{lead.stage}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">{lead.value}</div>
                      <div
                        className={`text-xs px-2 py-1 rounded ${
                          lead.score > 80
                            ? "bg-green-900/30 text-green-300"
                            : "bg-yellow-900/30 text-yellow-300"
                        }`}
                      >
                        {lead.score}% match
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-stone-500">
                    {lead.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "sources" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Lead Sources</h3>
            {sources.map((source, index) => (
              <div key={index} className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-white font-medium">{source.name}</div>
                    <div className="text-sm text-stone-400">
                      {source.leads} leads
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-medium">
                      {source.conversion}
                    </div>
                    <div className="text-xs text-stone-400">conversion</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Keep outreach tab unchanged */}
        {activeTab === "outreach" && (
          <div className="space-y-4">
            <div className="bg-stone-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">
                Outreach Templates
              </h3>
              <div className="space-y-2">
                <button
                  className={`w-full text-left p-2 rounded text-sm ${
                    userSide === "light"
                      ? "bg-blue-900/30 text-blue-300"
                      : "bg-red-900/30 text-red-300"
                  }`}
                >
                  Cold Email - Developer Tools
                </button>
                <button className="w-full text-left p-2 rounded text-sm bg-stone-700 text-stone-300">
                  LinkedIn Connection - Startup
                </button>
                <button className="w-full text-left p-2 rounded text-sm bg-stone-700 text-stone-300">
                  Follow-up - Post Demo
                </button>
              </div>
            </div>

            <div className="bg-stone-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Automation</h3>
              <div className="flex items-center justify-between">
                <span className="text-stone-300">Auto-qualify leads</span>
                <div
                  className={`w-10 h-6 rounded-full ${
                    userSide === "light" ? "bg-blue-600" : "bg-red-600"
                  } relative`}
                >
                  <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1"></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
