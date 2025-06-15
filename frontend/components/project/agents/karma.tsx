"use client";

import { useState } from "react";
import { DollarSign, Target, CheckCircle, Calendar } from "lucide-react";
import { getAgentDisplayName } from "@/utils/agentUtils";

interface KarmaAgentProps {
  userSide: "light" | "dark" | null;
}

const extractValue = (obj: { "%share": string }) => obj["%share"];

export default function KarmaAgent({ userSide }: KarmaAgentProps) {
  const [activeTab, setActiveTab] = useState("grants");
  const agentId = "karma";

  // Mock grants data matching schema
  const projectData = {
    _id: "grant-project-001",
    name: { "%share": "MasumiAI" },
    desc: {
      "%share":
        "AI-powered development assistant for enhanced coding productivity",
    },
    links: { "%share": "https://github.com/user/masumi-ai" },
    image_url: { "%share": "https://example.com/masumi-logo.png" },
    owner_address: { "%share": "0x1234567890abcdef1234567890abcdef12345678" },
    members: {
      "%share": JSON.stringify(["alice@example.com", "bob@example.com"]),
    },
    user_email: { "%share": "contact@masumi.ai" },
    user_name: { "%share": "MasumiAI Team" },
    grants: [
      {
        id: { "%share": "gr-001" },
        name: { "%share": "Ethereum Foundation Grant" },
        desc: { "%share": "$50K for AI development tools research" },
        applied_at: { "%share": "2024-05-15" },
      },
      {
        id: { "%share": "gr-002" },
        name: { "%share": "Gitcoin Grants Round" },
        desc: { "%share": "$15K community funding for open source AI tools" },
        applied_at: { "%share": "2024-06-01" },
      },
    ],
    milestones: [
      {
        id: { "%share": "ms-001" },
        grant_id: { "%share": "gr-001" },
        name: { "%share": "MVP Development" },
        desc: { "%share": "Complete core AI assistant functionality" },
        created_at: { "%share": "2024-05-20" },
      },
      {
        id: { "%share": "ms-002" },
        grant_id: { "%share": "gr-001" },
        name: { "%share": "Beta Testing" },
        desc: { "%share": "Launch beta with 100+ developers" },
        created_at: { "%share": "2024-06-10" },
      },
    ],
  };

  const project = {
    name: extractValue(projectData.name),
    description: extractValue(projectData.desc),
    grants: projectData.grants.map((g) => ({
      id: extractValue(g.id),
      name: extractValue(g.name),
      description: extractValue(g.desc),
      appliedAt: extractValue(g.applied_at),
    })),
    milestones: projectData.milestones.map((m) => ({
      id: extractValue(m.id),
      grantId: extractValue(m.grant_id),
      name: extractValue(m.name),
      description: extractValue(m.desc),
      createdAt: extractValue(m.created_at),
    })),
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-stone-700">
        <div className="flex items-center space-x-2">
          <img
            src={`/agents/${userSide}/${agentId}.png`}
            alt=""
            className="w-5 h-5"
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
          Registered
        </div>
      </div>

      <div className="flex border-b border-stone-700">
        {["grants", "milestones", "opportunities"].map((tab) => (
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
        {activeTab === "grants" && (
          <div className="space-y-4">
            <div className="bg-stone-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">{project.name}</h3>
              <p className="text-sm text-stone-300">{project.description}</p>
            </div>

            <h3 className="text-white font-medium">
              Applied Grants ({project.grants.length})
            </h3>
            {project.grants.map((grant) => (
              <div key={grant.id} className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-white font-medium">{grant.name}</div>
                  <div className="text-xs text-stone-400">
                    {grant.appliedAt}
                  </div>
                </div>
                <p className="text-sm text-stone-300">{grant.description}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "milestones" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Project Milestones</h3>
            {project.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className="bg-stone-800/50 rounded-lg p-3"
              >
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-white font-medium">
                      {milestone.name}
                    </div>
                    <p className="text-sm text-stone-300 mb-1">
                      {milestone.description}
                    </p>
                    <div className="text-xs text-stone-500">
                      Grant:{" "}
                      {
                        project.grants.find((g) => g.id === milestone.grantId)
                          ?.name
                      }{" "}
                      • {milestone.createdAt}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              className={`w-full p-3 rounded-lg border-2 border-dashed ${
                userSide === "light"
                  ? "border-blue-500 text-blue-400"
                  : "border-red-500 text-red-400"
              } hover:bg-stone-800/30`}
            >
              <Target className="w-4 h-4 mx-auto mb-1" />
              <div className="text-sm">Add New Milestone</div>
            </button>
          </div>
        )}

        {activeTab === "opportunities" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Grant Opportunities</h3>

            <div className="bg-stone-800/50 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="text-white font-medium">
                  Optimism Retroactive Funding
                </div>
                <div className="text-green-400 text-sm">$100K</div>
              </div>
              <p className="text-sm text-stone-300 mb-2">
                Funding for public goods that benefit the Optimism ecosystem
              </p>
              <button
                className={`px-3 py-1 rounded text-xs ${
                  userSide === "light"
                    ? "bg-blue-600 text-white"
                    : "bg-red-600 text-white"
                }`}
              >
                Apply Now
              </button>
            </div>

            <div className="bg-stone-800/50 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="text-white font-medium">
                  Protocol Labs Grant
                </div>
                <div className="text-green-400 text-sm">$25K</div>
              </div>
              <p className="text-sm text-stone-300 mb-2">
                Supporting developer tools and infrastructure projects
              </p>
              <button
                className={`px-3 py-1 rounded text-xs ${
                  userSide === "light"
                    ? "bg-blue-600 text-white"
                    : "bg-red-600 text-white"
                }`}
              >
                Apply Now
              </button>
            </div>

            <div className="bg-stone-800/50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-white text-sm">
                  Total Funding Applied: $65K
                </span>
              </div>
              <div className="text-xs text-stone-400">
                View project on Karma HQ: gap.karmahq.xyz
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
