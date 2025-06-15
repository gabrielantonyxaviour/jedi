"use client";

import { useState } from "react";
import { Shield, ExternalLink, Users, Eye, Plus, X } from "lucide-react";
import { getAgentDisplayName } from "@/utils/agentUtils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface IPAgentProps {
  userSide: "light" | "dark" | null;
  isSetup?: boolean;
  setup?: (data: any) => void;
  userAddress?: string;
}

const extractValue = (obj: { "%share": string }) => obj["%share"];

export default function IPAgent({
  userSide,
  isSetup = true,
  setup = () => console.log("Setup called"),
  userAddress = "0x1234567890abcdef1234567890abcdef12345678",
}: IPAgentProps) {
  const [activeTab, setActiveTab] = useState("assets");
  const agentId = "ip";

  // Setup form state
  const [formData, setFormData] = useState({
    name: "",
    desc: "",
    image_url: "",
    owners: [userAddress],
    remix_license_terms: "",
  });
  const [newOwner, setNewOwner] = useState("");

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addOwner = () => {
    if (newOwner.trim() && !formData.owners.includes(newOwner.trim())) {
      setFormData((prev) => ({
        ...prev,
        owners: [...prev.owners, newOwner.trim()],
      }));
      setNewOwner("");
    }
  };

  const removeOwner = (ownerToRemove: string) => {
    if (ownerToRemove === userAddress) return;

    setFormData((prev) => ({
      ...prev,
      owners: prev.owners.filter((owner) => owner !== ownerToRemove),
    }));
  };

  const handleSubmit = () => {
    if (
      formData.name &&
      formData.desc &&
      formData.owners.length > 0 &&
      formData.remix_license_terms
    ) {
      setup(formData);
    }
  };

  // Setup form when isSetup is false
  if (!isSetup) {
    return (
      <div className="h-full flex flex-col bg-stone-800/50">
        <div className="flex items-center justify-between p-4 border-b border-stone-700">
          <div className="flex items-center space-x-2">
            <img
              src={`/agents/${userSide}/${agentId}.png`}
              alt=""
              className="w-9 h-9"
            />
            <span className="font-medium text-white">
              Setup {getAgentDisplayName(agentId, userSide)}
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

        <ScrollArea className="h-[550px]">
          <div className="p-4">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Configure Your IP Agent
                </h2>
                <p className="text-stone-400">
                  Set up your intellectual property agent to get started
                </p>
              </div>

              <div className="bg-stone-800/50 rounded-lg p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-300">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter project name"
                    className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-white placeholder-stone-400 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-300">
                    Description *
                  </label>
                  <textarea
                    value={formData.desc}
                    onChange={(e) => handleInputChange("desc", e.target.value)}
                    placeholder="Describe your project"
                    rows={4}
                    className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-white placeholder-stone-400 focus:outline-none focus:border-blue-500 resize-none"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-300">
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) =>
                      handleInputChange("image_url", e.target.value)
                    }
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-white placeholder-stone-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-300">
                    Owners *
                  </label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {formData.owners.map((owner, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-2 py-1 bg-stone-700 rounded text-sm text-stone-300"
                        >
                          <span className="font-mono">
                            {owner === userAddress
                              ? `${owner.slice(0, 6)}...${owner.slice(
                                  -4
                                )} (You)`
                              : `${owner.slice(0, 6)}...${owner.slice(-4)}`}
                          </span>
                          {owner !== userAddress && (
                            <X
                              className="h-3 w-3 cursor-pointer hover:text-red-400"
                              onClick={() => removeOwner(owner)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newOwner}
                        onChange={(e) => setNewOwner(e.target.value)}
                        placeholder="Add owner address"
                        className="flex-1 px-3 py-2 bg-stone-700 border border-stone-600 rounded text-white placeholder-stone-400 focus:outline-none focus:border-blue-500"
                        onKeyDown={(e) => e.key === "Enter" && addOwner()}
                      />
                      <button
                        type="button"
                        onClick={addOwner}
                        disabled={!newOwner.trim()}
                        className="px-3 py-2 bg-stone-600 hover:bg-stone-500 disabled:bg-stone-700 disabled:text-stone-500 text-white rounded flex items-center"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-300">
                    Remix License Terms *
                  </label>
                  <select
                    value={formData.remix_license_terms}
                    onChange={(e) =>
                      handleInputChange("remix_license_terms", e.target.value)
                    }
                    className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded text-white focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Select license terms</option>
                    <option value="commercial">Commercial</option>
                    <option value="non-commercial">Non-Commercial</option>
                  </select>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={
                    !formData.name ||
                    !formData.desc ||
                    formData.owners.length === 0 ||
                    !formData.remix_license_terms
                  }
                  className={`w-full py-3 rounded font-medium transition-colors ${
                    !formData.name ||
                    !formData.desc ||
                    formData.owners.length === 0 ||
                    !formData.remix_license_terms
                      ? "bg-stone-700 text-stone-400 cursor-not-allowed"
                      : userSide === "light"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  Confirm Setup
                </button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Mock Story Protocol IP assets (corrected format)
  const ipAssets = [
    {
      _id: "story-001",
      owner_address: "0x1234567890abcdef1234567890abcdef12345678",
      project_id: "proj_001",
      name: "MasumiAI Core",
      desc: "AI-powered development assistant with advanced code analysis and intelligent suggestions",
      owners: "author123",
      image_url: "https://example.com/masumi-logo.png",
      ipa: "0x789abc123def456",
      parent_ipa: "empty",
      remix_license_terms: "commercial",
      register_tx_hash:
        "0x456def789abc123ghi456jkl789mno012pqr345stu678vwx901yz234",
    },
    {
      _id: "story-002",
      owner_address: "0x1234567890abcdef1234567890abcdef12345678",
      project_id: "proj_002",
      name: "Code Analysis Module",
      desc: "Specialized module for real-time code quality assessment derived from MasumiAI Core",
      owners: "author123",
      image_url: "https://example.com/module-logo.png",
      ipa: "0xdef456789abc123",
      parent_ipa: "0x789abc123def456",
      remix_license_terms: "non-commercial",
      register_tx_hash:
        "0x789abc456def123ghi789jkl456mno123pqr789stu456vwx123yz789",
    },
  ];

  const assets = ipAssets.map((asset) => ({
    id: asset._id,
    name: asset.name,
    description: asset.desc,
    owners: [asset.owner_address], // Simplified for display
    imageUrl: asset.image_url,
    ipa: asset.ipa,
    parentIpa: asset.parent_ipa,
    licenseType: asset.remix_license_terms,
    txHash: asset.register_tx_hash,
    projectId: asset.project_id,
    ownersList: asset.owners,
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
                    <p className="text-xs text-stone-400 mt-1">
                      Project ID: {asset.projectId}
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
                    <span className="text-stone-400">Owner Address:</span>
                    <span className="text-stone-300 font-mono">
                      {asset.owners[0].slice(0, 6)}...
                      {asset.owners[0].slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Owners:</span>
                    <span className="text-stone-300">{asset.ownersList}</span>
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
