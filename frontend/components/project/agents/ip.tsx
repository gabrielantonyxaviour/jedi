"use client";

import { useState } from "react";
import { Shield, FileText, ExternalLink, Users } from "lucide-react";
import { getAgentDisplayName } from "@/utils/agentUtils";

interface IPAgentProps {
  userSide: "light" | "dark" | null;
}

const extractValue = (obj: { "%share": string }) => obj["%share"];

export default function IPAgent({ userSide }: IPAgentProps) {
  const [activeTab, setActiveTab] = useState("stories");
  const agentId = "ip";

  // Mock data matching stories schema
  const storiesData = [
    {
      _id: "story-001",
      name: { "%share": "MasumiAI Core Engine" },
      desc: {
        "%share":
          "AI-powered development assistant with advanced code analysis capabilities",
      },
      owners: {
        "%share": JSON.stringify(["0x1234567890abcdef", "0x2345678901bcdef0"]),
      },
      image_url: { "%share": "https://example.com/masumi-ai-logo.png" },
      ipa: { "%share": "0xABC123456789DEF" },
      parent_ipa: { "%share": "0x000000000000000" },
      remix_license_terms: {
        "%share": "MIT License with attribution requirements",
      },
      register_tx_hash: {
        "%share": "0x789abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
      },
    },
    {
      _id: "story-002",
      name: { "%share": "Code Analysis Module" },
      desc: {
        "%share":
          "Specialized module for real-time code quality assessment and suggestions",
      },
      owners: { "%share": JSON.stringify(["0x1234567890abcdef"]) },
      image_url: { "%share": "https://example.com/code-module.png" },
      ipa: { "%share": "0xDEF456789ABC123" },
      parent_ipa: { "%share": "0xABC123456789DEF" },
      remix_license_terms: { "%share": "Apache 2.0 with patent grant" },
      register_tx_hash: {
        "%share": "0x456def789abc123ghi456jkl789mno012pqr345stu678vwx901yz",
      },
    },
  ];

  const stories = storiesData.map((story) => ({
    id: story._id,
    name: extractValue(story.name),
    description: extractValue(story.desc),
    owners: JSON.parse(extractValue(story.owners)),
    imageUrl: extractValue(story.image_url),
    ipa: extractValue(story.ipa),
    parentIpa: extractValue(story.parent_ipa),
    license: extractValue(story.remix_license_terms),
    txHash: extractValue(story.register_tx_hash),
  }));

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
          {stories.length} Stories
        </div>
      </div>

      <div className="flex border-b border-stone-700">
        {["stories", "licensing", "blockchain"].map((tab) => (
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
        {activeTab === "stories" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">IP Stories</h3>
            {stories.map((story) => (
              <div key={story.id} className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-white font-medium">{story.name}</div>
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-stone-400" />
                    <span className="text-xs text-stone-400">
                      {story.owners.length}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-stone-300 mb-2">
                  {story.description}
                </p>
                <div className="text-xs text-stone-500">
                  IPA: {story.ipa.slice(0, 10)}...
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "licensing" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">License Terms</h3>
            {stories.map((story) => (
              <div key={story.id} className="bg-stone-800/50 rounded-lg p-3">
                <div className="text-white font-medium mb-2">{story.name}</div>
                <div className="text-sm text-stone-300 mb-2">
                  {story.license}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-stone-500">
                    Parent:{" "}
                    {story.parentIpa === "0x000000000000000"
                      ? "Root"
                      : `${story.parentIpa.slice(0, 10)}...`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "blockchain" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Blockchain Records</h3>
            {stories.map((story) => (
              <div key={story.id} className="bg-stone-800/50 rounded-lg p-3">
                <div className="text-white font-medium mb-2">{story.name}</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-400">TX Hash:</span>
                    <span className="text-stone-300 font-mono">
                      {story.txHash.slice(0, 16)}...
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">IPA:</span>
                    <span className="text-stone-300 font-mono">
                      {story.ipa}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Owners:</span>
                    <span className="text-stone-300">
                      {story.owners.length}
                    </span>
                  </div>
                </div>
                <button
                  className={`mt-2 px-2 py-1 rounded text-xs ${
                    userSide === "light"
                      ? "bg-blue-600 text-white"
                      : "bg-red-600 text-white"
                  }`}
                >
                  View on Explorer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
