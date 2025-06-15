"use client";

import { useState } from "react";
import { Twitter, Linkedin, Instagram, TrendingUp } from "lucide-react";
import { getAgentDisplayName } from "@/utils/agentUtils";

interface SocialsAgentProps {
  userSide: "light" | "dark" | null;
}

export default function SocialsAgent({ userSide }: SocialsAgentProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const agentId = "socials";

  const mockData = {
    platforms: [
      { name: "Twitter", followers: 12500, engagement: "3.2%", icon: Twitter },
      { name: "LinkedIn", followers: 8900, engagement: "5.1%", icon: Linkedin },
      {
        name: "Instagram",
        followers: 5600,
        engagement: "4.8%",
        icon: Instagram,
      },
    ],
    suggestions: [
      "Post about your latest GitHub release",
      "Share development insights on LinkedIn",
      "Create a thread about your tech stack",
      "Engage with developer community hashtags",
    ],
    metrics: {
      totalReach: 45600,
      weeklyGrowth: "+2.3%",
      avgEngagement: "4.2%",
    },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-stone-700">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-white" />
          <span className="font-medium text-white">Socials Agent</span>
        </div>
        <div
          className={`px-2 py-1 rounded text-xs ${
            userSide === "light"
              ? "bg-blue-900/30 text-blue-300"
              : "bg-red-900/30 text-red-300"
          }`}
        >
          Active
        </div>
      </div>

      <div className="flex border-b border-stone-700">
        {["overview", "content", "analytics"].map((tab) => (
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
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-stone-800/50 rounded-lg p-3 text-center">
                <div className="text-white font-medium text-lg">
                  {mockData.metrics.totalReach.toLocaleString()}
                </div>
                <div className="text-xs text-stone-400">Total Reach</div>
              </div>
              <div className="bg-stone-800/50 rounded-lg p-3 text-center">
                <div className="text-green-400 font-medium text-lg">
                  {mockData.metrics.weeklyGrowth}
                </div>
                <div className="text-xs text-stone-400">Weekly Growth</div>
              </div>
              <div className="bg-stone-800/50 rounded-lg p-3 text-center">
                <div className="text-white font-medium text-lg">
                  {mockData.metrics.avgEngagement}
                </div>
                <div className="text-xs text-stone-400">Avg Engagement</div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-medium">Connected Platforms</h3>
              {mockData.platforms.map((platform) => (
                <div
                  key={platform.name}
                  className="bg-stone-800/50 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <platform.icon className="w-5 h-5 text-blue-400" />
                      <span className="text-white">{platform.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">
                        {platform.followers.toLocaleString()}
                      </div>
                      <div className="text-xs text-stone-400">
                        {platform.engagement} eng.
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "content" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Content Suggestions</h3>
            {mockData.suggestions.map((suggestion, index) => (
              <div key={index} className="bg-stone-800/50 rounded-lg p-3">
                <p className="text-stone-300 text-sm">{suggestion}</p>
                <div className="flex space-x-2 mt-2">
                  <button
                    className={`px-3 py-1 rounded text-xs ${
                      userSide === "light"
                        ? "bg-blue-600 text-white"
                        : "bg-red-600 text-white"
                    }`}
                  >
                    Generate
                  </button>
                  <button className="px-3 py-1 rounded text-xs bg-stone-700 text-white">
                    Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-4">
            <div className="bg-stone-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">
                Performance Metrics
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-400">Impressions (7d)</span>
                  <span className="text-white">156K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Clicks (7d)</span>
                  <span className="text-white">2.1K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Shares (7d)</span>
                  <span className="text-white">89</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
