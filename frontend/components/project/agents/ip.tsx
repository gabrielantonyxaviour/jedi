"use client";

import { useState } from "react";
import { Shield, ExternalLink, Users, Eye } from "lucide-react";
import { getAgentDisplayName } from "@/utils/agentUtils";

interface IPAgentProps {
  userSide: "light" | "dark" | null;
}

const extractValue = (obj: { "%share": string }) => obj["%share"];

export default function IPAgent({ userSide }: IPAgentProps) {
  const [activeTab, setActiveTab] = useState("assets");
  const agentId = "ip";

  // Mock Story Protocol IP assets
  const ipAssets = [
    {
      _id: "story-001",
      name: { "%share": "MasumiAI Core" },
      desc: {
        "%share":
          "AI-powered development assistant with advanced code analysis and intelligent suggestions",
      },
      owners: {
        "%share": JSON.stringify([
          "0x1234567890abcdef1234567890abcdef12345678",
          "0x2345678901bcdef02345678901bcdef023456789",
        ]),
      },
      image_url: { "%share": "https://example.com/masumi-logo.png" },
      ipa: { "%share": "0x789abc123def456" },
      parent_ipa: { "%share": "empty" },
      remix_license_terms: { "%share": "commercial" },
      register_tx_hash: {
        "%share": "0x456def789abc123ghi456jkl789mno012pqr345stu678vwx901yz234",
      },
    },
    {
      _id: "story-002",
      name: { "%share": "Code Analysis Module" },
      desc: {
        "%share":
          "Specialized module for real-time code quality assessment derived from MasumiAI Core",
      },
      owners: {
        "%share": JSON.stringify([
          "0x1234567890abcdef1234567890abcdef12345678",
        ]),
      },
      image_url: { "%share": "https://example.com/module-logo.png" },
      ipa: { "%share": "0xdef456789abc123" },
      parent_ipa: { "%share": "0x789abc123def456" },
      remix_license_terms: { "%share": "non-commercial" },
      register_tx_hash: {
        "%share": "0x789abc456def123ghi789jkl456mno123pqr789stu456vwx123yz789",
      },
    },
  ];

  const assets = ipAssets.map((asset) => ({
    id: asset._id,
    name: extractValue(asset.name),
    description: extractValue(asset.desc),
    owners: JSON.parse(extractValue(asset.owners)),
    imageUrl: extractValue(asset.image_url),
    ipa: extractValue(asset.ipa),
    parentIpa: extractValue(asset.parent_ipa),
    licenseType: extractValue(asset.remix_license_terms),
    txHash: extractValue(asset.register_tx_hash),
  }));

  const openExplorer = (txHash: string) => {
    window.open(`https://explorer.story.foundation/tx/${txHash}`, "_blank");
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
        <div
          className={`px-2 py-1 rounded text-xs ${
            userSide === "light"
              ? "bg-blue-900/30 text-blue-300"
              : "bg-red-900/30 text-red-300"
          }`}
        >
          Story Protocol
        </div>
      </div>

      <div className="flex border-b border-stone-700">
        {["assets", "ownership", "lineage"].map((tab) => (
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
        {activeTab === "assets" && (
          <div className="space-y-4">
            {assets.map((asset) => (
              <div key={asset.id} className="bg-stone-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-white font-medium text-lg">
                      {asset.name}
                    </h3>
                    <p className="text-sm text-stone-300 mt-1">
                      {asset.description}
                    </p>
                  </div>
                  <div
                    className={`px-2 py-1 rounded text-xs ${
                      asset.licenseType === "commercial"
                        ? "bg-green-900/30 text-green-300"
                        : "bg-blue-900/30 text-blue-300"
                    }`}
                  >
                    {asset.licenseType}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-400">IPA ID:</span>
                    <span className="text-stone-300 font-mono">
                      {asset.ipa}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Owners:</span>
                    <span className="text-stone-300">
                      {asset.owners.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Type:</span>
                    <span className="text-stone-300">
                      {asset.parentIpa === "empty"
                        ? "Parent Asset"
                        : "Child Asset"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => openExplorer(asset.txHash)}
                  className={`mt-3 flex items-center space-x-2 px-3 py-1 rounded text-sm ${
                    userSide === "light"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>View on Explorer</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "ownership" && (
          <div className="space-y-4">
            {assets.map((asset) => (
              <div key={asset.id} className="bg-stone-800/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-3">{asset.name}</h3>
                <div className="space-y-2">
                  {asset.owners.map((owner: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-stone-400" />
                        <span className="text-stone-300 font-mono text-sm">
                          {owner.slice(0, 6)}...{owner.slice(-4)}
                        </span>
                      </div>
                      <span className="text-xs text-stone-400">
                        Owner {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "lineage" && (
          <div className="space-y-4">
            {assets.map((asset) => (
              <div key={asset.id} className="bg-stone-800/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-3">{asset.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Current IPA:</span>
                    <span className="text-stone-300 font-mono">
                      {asset.ipa}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Parent IPA:</span>
                    <span className="text-stone-300 font-mono">
                      {asset.parentIpa === "empty"
                        ? "Root Asset"
                        : asset.parentIpa}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">License:</span>
                    <span className="text-stone-300 capitalize">
                      {asset.licenseType}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
