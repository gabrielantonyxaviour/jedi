"use client";

import { useState } from "react";
import { Target } from "lucide-react";

interface LeadsAgentProps {
  userSide: "light" | "dark" | null;
}

export default function LeadsAgent({ userSide }: LeadsAgentProps) {
  const [activeTab, setActiveTab] = useState("pipeline");

  const mockData = {
    pipeline: [
      { name: "TechCorp Inc", stage: "Qualified", score: 85, value: "$15K" },
      { name: "StartupXYZ", stage: "Proposal", score: 72, value: "$8K" },
      { name: "Enterprise Co", stage: "Discovery", score: 90, value: "$25K" },
    ],
    metrics: {
      totalLeads: 47,
      qualified: 23,
      converted: 8,
      revenue: "$156K",
    },
    sources: [
      { name: "GitHub", leads: 18, conversion: "12%" },
      { name: "LinkedIn", leads: 15, conversion: "8%" },
      { name: "Website", leads: 14, conversion: "15%" },
    ],
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Target className="w-5 h-5 text-white" />
          <span className="font-medium text-white">Leads Agent</span>
        </div>
        <div
          className={`px-2 py-1 rounded text-xs ${
            userSide === "light"
              ? "bg-blue-900/30 text-blue-300"
              : "bg-red-900/30 text-red-300"
          }`}
        >
          Tracking
        </div>
      </div>

      <div className="flex border-b border-gray-700">
        {["pipeline", "sources", "outreach"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize ${
              activeTab === tab
                ? userSide === "light"
                  ? "border-b-2 border-blue-500 text-blue-400"
                  : "border-b-2 border-red-500 text-red-400"
                : "text-gray-400 hover:text-white"
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
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-white font-medium text-lg">
                  {mockData.metrics.totalLeads}
                </div>
                <div className="text-xs text-gray-400">Total Leads</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-green-400 font-medium text-lg">
                  {mockData.metrics.revenue}
                </div>
                <div className="text-xs text-gray-400">Revenue</div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-medium">Active Pipeline</h3>
              {mockData.pipeline.map((lead, index) => (
                <div key={index} className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-white font-medium">{lead.name}</div>
                      <div className="text-sm text-gray-400">{lead.stage}</div>
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
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "sources" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Lead Sources</h3>
            {mockData.sources.map((source, index) => (
              <div key={index} className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-white font-medium">{source.name}</div>
                    <div className="text-sm text-gray-400">
                      {source.leads} leads
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-medium">
                      {source.conversion}
                    </div>
                    <div className="text-xs text-gray-400">conversion</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "outreach" && (
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
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
                <button className="w-full text-left p-2 rounded text-sm bg-gray-700 text-gray-300">
                  LinkedIn Connection - Startup
                </button>
                <button className="w-full text-left p-2 rounded text-sm bg-gray-700 text-gray-300">
                  Follow-up - Post Demo
                </button>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Automation</h3>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Auto-qualify leads</span>
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
