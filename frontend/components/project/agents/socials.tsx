"use client";

import { useState } from "react";
import {
  Twitter,
  MessageCircle,
  TrendingUp,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import { getAgentDisplayName } from "@/utils/agentUtils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";

interface SocialsAgentProps {
  userSide: "light" | "dark" | null;
  isSetup: boolean;
  setup: () => void;
}

export default function SocialsAgent({
  userSide,
  isSetup,
  setup,
}: SocialsAgentProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showPassword, setShowPassword] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupData, setSetupData] = useState({
    twitterUsername: "jedionchain",
    twitterEmail: "jedionchain@gmail.com",
    twitterPassword: "69#JediOffChain#420",
    telegramUsername: "JediOnChain_bot",
    telegramBotToken: "7895110798:AAHpBHh1cAYd5dHa98c-W-3BEP6e66BWsJ8",
  });
  const agentId = "socials";

  // Mock data matching schema
  const socialsData = {
    owner_address: "0x0429A2Da7884CA14E53142988D5845952fE4DF6a",
    project_id: uuidv4(),
    twitter: {
      name: process.env.TWITTER_USERNAME,
      email: process.env.TWITTER_EMAIL,
      password: process.env.TWITTER_PASSWORD,
    },
    telegram: {
      username: "mybot_telegram",
      bot_token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    },
    twitter_actions: [
      {
        id: "1",
        action: "tweet",
        ref_id: "",
        text: "hear me out.\n if you build cool shit, you don't need a co-founder.\nyou need a jedi.",
      },
    ],
    telegram_actions: [],
  };

  // Transform data for UI
  const connectedAccounts = {
    twitter: {
      name: "Jedi",
      username: `@${"jedionchain"}`,
      connected: true,
      recentActions: socialsData.twitter_actions.length,
    },
    telegram: {
      name: "Jedi",
      username: `@${"JediOnChain_bot"}`,
      connected: true,
      recentActions: socialsData.telegram_actions.length,
    },
  };

  const recentActions = [
    ...socialsData.twitter_actions.map((action) => ({
      platform: "Twitter",
      type: action.action,
      text: action.text,
      id: action.id,
      icon: Twitter,
    })),
    ...socialsData.telegram_actions.map((action) => ({
      platform: "Telegram",
      type: "message",
      text: (action as any).text,
      id: (action as any).id,
      icon: MessageCircle,
    })),
  ];

  const metrics = {
    totalActions: recentActions.length,
    platforms: 2,
    weeklyActions: recentActions.length, // Mock recent activity
  };

  const handleInputChange = (field: string, value: string) => {
    setSetupData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const isFormValid = () => {
    return (
      setupData.twitterUsername &&
      setupData.twitterEmail &&
      setupData.twitterPassword &&
      setupData.telegramUsername &&
      setupData.telegramBotToken
    );
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
              {getAgentDisplayName(agentId, userSide)} - Setup
            </span>
          </div>
        </div>

        <ScrollArea className="h-[550px]">
          <div className="p-4">
            <div className="max-w-md mx-auto space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-white text-lg font-medium mb-2">
                  Configure Social Accounts
                </h2>
                <p className="text-stone-400 text-sm">
                  Connect your Twitter and Telegram accounts to get started
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-stone-800/50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Twitter className="w-5 h-5 text-blue-400" />
                    <h3 className="text-white font-medium">Twitter Account</h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-stone-300 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        placeholder="Enter Twitter username"
                        value={setupData.twitterUsername}
                        onChange={(e) =>
                          handleInputChange("twitterUsername", e.target.value)
                        }
                        className="w-full p-2 bg-stone-700 border border-stone-600 rounded text-white placeholder-stone-400 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-stone-300 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        placeholder="Enter Twitter email"
                        value={setupData.twitterEmail}
                        onChange={(e) =>
                          handleInputChange("twitterEmail", e.target.value)
                        }
                        className="w-full p-2 bg-stone-700 border border-stone-600 rounded text-white placeholder-stone-400 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-stone-300 mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter Twitter password"
                          value={setupData.twitterPassword}
                          onChange={(e) =>
                            handleInputChange("twitterPassword", e.target.value)
                          }
                          className="w-full p-2 bg-stone-700 border border-stone-600 rounded text-white placeholder-stone-400 focus:border-blue-500 focus:outline-none pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-stone-400 hover:text-white"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-stone-800/50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <MessageCircle className="w-5 h-5 text-blue-400" />
                    <h3 className="text-white font-medium">Telegram Bot</h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-stone-300 mb-1">
                        Bot Username
                      </label>
                      <input
                        type="text"
                        placeholder="@your_bot_username"
                        value={setupData.telegramUsername}
                        onChange={(e) =>
                          handleInputChange("telegramUsername", e.target.value)
                        }
                        className="w-full p-2 bg-stone-700 border border-stone-600 rounded text-white placeholder-stone-400 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-stone-300 mb-1">
                        Bot Token
                      </label>
                      <input
                        type="password"
                        placeholder="Enter bot token from @BotFather"
                        value={setupData.telegramBotToken}
                        onChange={(e) =>
                          handleInputChange("telegramBotToken", e.target.value)
                        }
                        className="w-full p-2 bg-stone-700 border border-stone-600 rounded text-white placeholder-stone-400 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={async () => {
                  setIsSettingUp(true);
                  await new Promise((resolve) => setTimeout(resolve, 5000));
                  setIsSettingUp(false);
                  setup();
                }}
                disabled={!isFormValid() || isSettingUp}
                className={`w-full p-3 rounded-lg font-medium transition-colors ${
                  isFormValid()
                    ? userSide === "light"
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-stone-700 text-stone-400 cursor-not-allowed"
                }`}
              >
                {isSettingUp ? "Setting Up" : "Confirm Setup"}
              </button>
            </div>
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
