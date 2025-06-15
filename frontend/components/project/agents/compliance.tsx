"use client";

import { useState } from "react";
import { Search, ExternalLink, GitBranch, Star } from "lucide-react";
import { getAgentDisplayName } from "@/utils/agentUtils";

interface ComplianceAgentProps {
  userSide: "light" | "dark" | null;
}

const extractValue = (obj: { "%share": string }) => obj["%share"];

export default function ComplianceAgent({ userSide }: ComplianceAgentProps) {
  const [activeTab, setActiveTab] = useState("similar");
  const agentId = "compliance";

  // Mock data for similar projects found
  const mockData = [
    {
      _id: "comp-001",
      name: { "%share": "CodeGPT" },
      source: { "%share": "GitHub" },
      data: {
        "%share":
          "AI-powered code assistant with 15.2k stars. Similar TypeScript/React architecture for developer tools.",
      },
    },
    {
      _id: "comp-002",
      name: { "%share": "Copilot Alternative" },
      source: { "%share": "Product Hunt" },
      data: {
        "%share":
          "Open-source AI coding assistant. Featured as top product with similar functionality to your project.",
      },
    },
    {
      _id: "comp-003",
      name: { "%share": "DevAssist Pro" },
      source: { "%share": "Hacker News" },
      data: {
        "%share":
          "Developer productivity tool using AI. Discussed in recent HN thread about AI development tools.",
      },
    },
    {
      _id: "comp-004",
      name: { "%share": "SmartCode AI" },
      source: { "%share": "Reddit" },
      data: {
        "%share":
          "Similar React-based AI development platform. Active community discussion in r/programming.",
      },
    },
  ];

  // Transform data for UI
  const similarProjects = mockData.map((item) => ({
    id: item.id,
    name: extractValue(item.name),
    source: extractValue(item.source),
    description: extractValue(item.data),
  }));

  const sources = [...new Set(similarProjects.map((p) => p.source))];
  const sourceStats = sources.map((source) => ({
    name: source,
    count: similarProjects.filter((p) => p.source === source).length,
  }));

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
        <div
          className={`px-2 py-1 rounded text-xs ${
            userSide === "light"
              ? "bg-blue-900/30 text-blue-300"
              : "bg-red-900/30 text-red-300"
          }`}
        >
          {similarProjects.length} Found
        </div>
      </div>

      <div className="flex border-b border-stone-700">
        {["similar", "sources", "analysis"].map((tab) => (
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
        {activeTab === "similar" && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Search className="w-4 h-4 text-stone-400" />
              <span className="text-sm text-stone-400">
                Similar projects to your development
              </span>
            </div>

            {similarProjects.map((project) => (
              <div key={project.id} className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-white font-medium">{project.name}</div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        userSide === "light"
                          ? "bg-blue-900/30 text-blue-300"
                          : "bg-red-900/30 text-red-300"
                      }`}
                    >
                      {project.source}
                    </span>
                    <ExternalLink className="w-4 h-4 text-stone-400 hover:text-white cursor-pointer" />
                  </div>
                </div>
                <p className="text-sm text-stone-300">{project.description}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "sources" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Discovery Sources</h3>
            {sourceStats.map((source, index) => (
              <div key={index} className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div className="text-white font-medium">{source.name}</div>
                  <div className="text-stone-400">{source.count} projects</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "analysis" && (
          <div className="space-y-4">
            <div className="bg-stone-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Market Analysis</h3>
              <div className="space-y-2 text-sm text-stone-300">
                <p>• {similarProjects.length} similar projects identified</p>
                <p>
                  • Most common source:{" "}
                  {sourceStats.sort((a, b) => b.count - a.count)[0]?.name}
                </p>
                <p>• High activity in AI development tools space</p>
                <p>• Competitive landscape shows strong developer interest</p>
              </div>
            </div>

            <div className="bg-stone-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Recommendations</h3>
              <div className="space-y-2 text-sm text-stone-300">
                <p>• Monitor competitor feature releases</p>
                <p>• Engage with communities discussing similar tools</p>
                <p>• Consider collaboration opportunities</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
