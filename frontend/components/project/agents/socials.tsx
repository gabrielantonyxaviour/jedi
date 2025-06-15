"use client";

import { useState } from "react";
import { Twitter, MessageCircle, TrendingUp, Send } from "lucide-react";
import { getAgentDisplayName } from "@/utils/agentUtils";

interface SocialsAgentProps {
  userSide: "light" | "dark" | null;
}

const extractValue = (obj: { "%share": string }) => obj["%share"];

export default function SocialsAgent({ userSide }: SocialsAgentProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const agentId = "socials";

  // Mock data matching schema
  const socialsData = {
    _id: "social-001",
    twitter: {
      name: { "%share": "MasumiAI" },
      email: { "%share": "contact@masumi.ai" },
      password: { "%share": "encrypted_password_hash" },
    },
    telegram: {
      username: { "%share": "@masumi_ai_bot" },
      bot_token: { "%share": "encrypted_bot_token" },
    },
    twitter_actions: [
      {
        id: { "%share": "tw_001" },
        action: { "%share": "tweet" },
        ref_id: { "%share": "repo_update_v1.2" },
        text: {
          "%share":
            "🚀 Just released v1.2 with exciting new AI features! Check out the latest updates on GitHub.",
        },
      },
      {
        id: { "%share": "tw_002" },
        action: { "%share": "retweet" },
        ref_id: { "%share": "dev_community_post" },
        text: {
          "%share": "Great insights from the developer community on AI trends!",
        },
      },
      {
        id: { "%share": "tw_003" },
        action: { "%share": "reply" },
        ref_id: { "%share": "user_question_001" },
        text: {
          "%share":
            "Thanks for the feedback! We're working on that feature for the next release.",
        },
      },
    ],
    telegram_actions: [
      {
        id: { "%share": "tg_001" },
        text: {
          "%share":
            "Welcome to MasumiAI! Type /help to see available commands.",
        },
        ref_user_id: { "%share": "user_123456" },
      },
      {
        id: { "%share": "tg_002" },
        text: {
          "%share":
            "Your project analysis is complete! Here's your detailed report...",
        },
        ref_user_id: { "%share": "user_789012" },
      },
    ],
  };

  // Transform data for UI
  const connectedAccounts = {
    twitter: {
      name: extractValue(socialsData.twitter.name),
      username: `@${extractValue(socialsData.twitter.name).toLowerCase()}`,
      connected: true,
      recentActions: socialsData.twitter_actions.length,
    },
    telegram: {
      name: extractValue(socialsData.telegram.username),
      connected: true,
      recentActions: socialsData.telegram_actions.length,
    },
  };

  const recentActions = [
    ...socialsData.twitter_actions.map((action) => ({
      platform: "Twitter",
      type: extractValue(action.action),
      text: extractValue(action.text),
      id: extractValue(action.id),
      icon: Twitter,
    })),
    ...socialsData.telegram_actions.map((action) => ({
      platform: "Telegram",
      type: "message",
      text: extractValue(action.text),
      id: extractValue(action.id),
      icon: MessageCircle,
    })),
  ];

  const metrics = {
    totalActions: recentActions.length,
    platforms: 2,
    weeklyActions: recentActions.length, // Mock recent activity
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
        {["overview", "actions", "automation"].map((tab) => (
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
                  {metrics.platforms}
                </div>
                <div className="text-xs text-stone-400">Connected</div>
              </div>
              <div className="bg-stone-800/50 rounded-lg p-3 text-center">
                <div className="text-green-400 font-medium text-lg">
                  {metrics.totalActions}
                </div>
                <div className="text-xs text-stone-400">Total Actions</div>
              </div>
              <div className="bg-stone-800/50 rounded-lg p-3 text-center">
                <div className="text-white font-medium text-lg">
                  {metrics.weeklyActions}
                </div>
                <div className="text-xs text-stone-400">This Week</div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-medium">Connected Accounts</h3>

              <div className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Twitter className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="text-white">
                        {connectedAccounts.twitter.name}
                      </div>
                      <div className="text-xs text-stone-400">
                        {connectedAccounts.twitter.username}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 text-sm">Connected</div>
                    <div className="text-xs text-stone-400">
                      {connectedAccounts.twitter.recentActions} recent actions
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <MessageCircle className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="text-white">Telegram Bot</div>
                      <div className="text-xs text-stone-400">
                        {connectedAccounts.telegram.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 text-sm">Connected</div>
                    <div className="text-xs text-stone-400">
                      {connectedAccounts.telegram.recentActions} recent messages
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "actions" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Recent Actions</h3>
            {recentActions.map((action, index) => (
              <div key={index} className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex items-start space-x-3">
                  <action.icon className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-white text-sm font-medium">
                        {action.platform}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-stone-700 text-stone-300">
                        {action.type}
                      </span>
                    </div>
                    <p className="text-stone-300 text-sm">{action.text}</p>
                  </div>
                </div>
              </div>
            ))}

            <button
              className={`w-full p-3 rounded-lg border-2 border-dashed ${
                userSide === "light"
                  ? "border-blue-500 text-blue-400"
                  : "border-red-500 text-red-400"
              } hover:bg-stone-800/30 transition-colors`}
            >
              <Send className="w-4 h-4 mx-auto mb-1" />
              <div className="text-sm">Schedule New Action</div>
            </button>
          </div>
        )}

        {activeTab === "automation" && (
          <div className="space-y-4">
            <div className="bg-stone-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Auto-Actions</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-stone-300">
                    Auto-tweet on new releases
                  </span>
                  <div
                    className={`w-10 h-6 rounded-full ${
                      userSide === "light" ? "bg-blue-600" : "bg-red-600"
                    } relative`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-300">Telegram notifications</span>
                  <div
                    className={`w-10 h-6 rounded-full ${
                      userSide === "light" ? "bg-blue-600" : "bg-red-600"
                    } relative`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-300">Auto-reply to mentions</span>
                  <div className="w-10 h-6 rounded-full bg-stone-600 relative">
                    <div className="w-4 h-4 bg-white rounded-full absolute top-1 left-1"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-stone-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Action Templates</h3>
              <div className="space-y-2">
                <button
                  className={`w-full text-left p-2 rounded text-sm ${
                    userSide === "light"
                      ? "bg-blue-900/30 text-blue-300"
                      : "bg-red-900/30 text-red-300"
                  }`}
                >
                  Release Announcement
                </button>
                <button className="w-full text-left p-2 rounded text-sm bg-stone-700 text-stone-300">
                  Feature Update
                </button>
                <button className="w-full text-left p-2 rounded text-sm bg-stone-700 text-stone-300">
                  Community Engagement
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
