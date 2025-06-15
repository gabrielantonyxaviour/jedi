"use client";

import { useState } from "react";
import { DollarSign, Target, CheckCircle, Calendar } from "lucide-react";
import { getAgentDisplayName } from "@/utils/agentUtils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface KarmaAgentProps {
  userSide: "light" | "dark" | null;
  isSetup: boolean;
  setup: () => void;
}

export default function KarmaAgent({
  userSide,
  isSetup,
  setup,
}: KarmaAgentProps) {
  const [activeTab, setActiveTab] = useState("grants");
  const [formData, setFormData] = useState({
    name: "",
    desc: "",
    ownerAddresses: [""],
    userEmail: "",
    userName: "",
  });

  const agentId = "karma";

  // Mock grants data with correct format
  const projectData = {
    project_id: "proj_123",
    name: "MasumiAI",
    desc: "AI-powered development assistant for enhanced coding productivity",
    links: "https://github.com/user/masumi-ai",
    image_url: "https://example.com/masumi-logo.png",
    owner_address: "0x1234567890abcdef1234567890abcdef12345678",
    members: "alice@example.com,bob@example.com",
    user_email: "contact@masumi.ai",
    user_name: "MasumiAI Team",
    grants: [
      {
        id: "gr-001",
        name: "Ethereum Foundation Grant",
        desc: "$50K for AI development tools research",
        applied_at: "2024-05-15",
      },
      {
        id: "gr-002",
        name: "Gitcoin Grants Round",
        desc: "$15K community funding for open source AI tools",
        applied_at: "2024-06-01",
      },
    ],
    milestones: [
      {
        id: "ms-001",
        grant_id: "gr-001",
        name: "MVP Development",
        desc: "Complete core AI assistant functionality",
        created_at: "2024-05-20",
      },
      {
        id: "ms-002",
        grant_id: "gr-001",
        name: "Beta Testing",
        desc: "Launch beta with 100+ developers",
        created_at: "2024-06-10",
      },
    ],
  };

  const updateFormData = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addOwnerAddress = () => {
    setFormData((prev) => ({
      ...prev,
      ownerAddresses: [...prev.ownerAddresses, ""],
    }));
  };

  const updateOwnerAddress = (index: number, value: string) => {
    const newAddresses = [...formData.ownerAddresses];
    newAddresses[index] = value;
    setFormData((prev) => ({ ...prev, ownerAddresses: newAddresses }));
  };

  const removeOwnerAddress = (index: number) => {
    if (formData.ownerAddresses.length > 1 && index !== 0) {
      const newAddresses = formData.ownerAddresses.filter(
        (_, i) => i !== index
      );
      setFormData((prev) => ({ ...prev, ownerAddresses: newAddresses }));
    }
  };

  if (!isSetup) {
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
          <div className="px-2 py-1 rounded text-xs bg-orange-900/30 text-orange-300">
            Setup Required
          </div>
        </div>

        <ScrollArea className="h-[500px]">
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">
                Project Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData("name", e.target.value)}
                className="bg-stone-800 border-stone-600 text-white"
                placeholder="Enter project name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc" className="text-white">
                Description
              </Label>
              <Textarea
                id="desc"
                value={formData.desc}
                onChange={(e) => updateFormData("desc", e.target.value)}
                className="bg-stone-800 border-stone-600 text-white"
                placeholder="Describe your project"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Owner Addresses</Label>
              {formData.ownerAddresses.map((address, index) => (
                <div key={index} className="flex space-x-2">
                  <Input
                    value={address}
                    onChange={(e) => updateOwnerAddress(index, e.target.value)}
                    className="bg-stone-800 border-stone-600 text-white flex-1"
                    placeholder="0x..."
                    disabled={index === 0}
                  />
                  {index === 0 && (
                    <span className="text-xs text-stone-400 self-center">
                      Your address
                    </span>
                  )}
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeOwnerAddress(index)}
                      className="bg-stone-800 border-stone-600 text-white"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOwnerAddress}
                className="bg-stone-800 border-stone-600 text-white"
              >
                Add Address
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userEmail" className="text-white">
                User Email
              </Label>
              <Input
                id="userEmail"
                type="email"
                value={formData.userEmail}
                onChange={(e) => updateFormData("userEmail", e.target.value)}
                className="bg-stone-800 border-stone-600 text-white"
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="userName" className="text-white">
                User Name
              </Label>
              <Input
                id="userName"
                value={formData.userName}
                onChange={(e) => updateFormData("userName", e.target.value)}
                className="bg-stone-800 border-stone-600 text-white"
                placeholder="Your name"
              />
            </div>

            <Button
              onClick={setup}
              className={`w-full ${
                userSide === "light"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
              disabled={
                !formData.name ||
                !formData.desc ||
                !formData.ownerAddresses[0] ||
                !formData.userEmail ||
                !formData.userName
              }
            >
              Confirm Setup
            </Button>
          </div>
        </ScrollArea>
      </div>
    );
  }

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

      <ScrollArea className="flex-1">
        <div className="p-4">
          {activeTab === "grants" && (
            <div className="space-y-4">
              <div className="bg-stone-800/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2">
                  {projectData.name}
                </h3>
                <p className="text-sm text-stone-300">{projectData.desc}</p>
              </div>

              <h3 className="text-white font-medium">
                Applied Grants ({projectData.grants.length})
              </h3>
              {projectData.grants.map((grant) => (
                <div key={grant.id} className="bg-stone-800/50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-white font-medium">{grant.name}</div>
                    <div className="text-xs text-stone-400">
                      {grant.applied_at}
                    </div>
                  </div>
                  <p className="text-sm text-stone-300">{grant.desc}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === "milestones" && (
            <div className="space-y-4">
              <h3 className="text-white font-medium">Project Milestones</h3>
              {projectData.milestones.map((milestone) => (
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
                        {milestone.desc}
                      </p>
                      <div className="text-xs text-stone-500">
                        Grant:{" "}
                        {
                          projectData.grants.find(
                            (g) => g.id === milestone.grant_id
                          )?.name
                        }{" "}
                        • {milestone.created_at}
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
      </ScrollArea>
    </div>
  );
}
