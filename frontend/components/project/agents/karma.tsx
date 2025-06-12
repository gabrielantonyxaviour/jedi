"use client";

import { useState } from "react";
import { Heart, Star } from "lucide-react";

interface KarmaAgentProps {
  userSide: "light" | "dark" | null;
}

export default function KarmaAgent({ userSide }: KarmaAgentProps) {
  const [activeTab, setActiveTab] = useState("score");

  const mockData = {
    karmaScore: 8750,
    rank: "Diamond",
    contributions: [
      { type: "Open Source", points: 2400, activity: "35 commits this month" },
      {
        type: "Community Help",
        points: 1800,
        activity: "12 questions answered",
      },
      { type: "Documentation", points: 1200, activity: "3 guides published" },
      { type: "Code Reviews", points: 900, activity: "18 reviews completed" },
    ],
    achievements: [
      {
        name: "Code Warrior",
        earned: "2024-03-15",
        description: "1000+ commits",
      },
      {
        name: "Helper",
        earned: "2024-02-20",
        description: "50+ questions answered",
      },
      {
        name: "Mentor",
        earned: "2024-01-10",
        description: "Guided 10+ developers",
      },
    ],
    impact: {
      developersHelped: 156,
      issuesResolved: 89,
      downloadsGenerated: "12.5K",
      starsEarned: 1247,
    },
  };

  const getThemeColor = (base: string) =>
    userSide === "light" ? `text-${base}-400` : `text-${base}-400`;
  const getThemeBg = (base: string) =>
    userSide === "light"
      ? `bg-${base}-900/30 text-${base}-300`
      : `bg-${base}-900/30 text-${base}-300`;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Heart className="w-5 h-5 text-white" />
          <span className="font-medium text-white">Karma Agent</span>
        </div>
        <div
          className={`px-2 py-1 rounded text-xs ${getThemeBg(
            userSide === "light" ? "blue" : "red"
          )}`}
        >
          {mockData.rank}
        </div>
      </div>

      <div className="flex border-b border-gray-700">
        {["score", "contributions", "achievements"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize ${
              activeTab === tab
                ? `${getThemeColor(
                    userSide === "light" ? "blue" : "red"
                  )} border-b-2 border-${
                    userSide === "light" ? "blue" : "red"
                  }-500`
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === "score" && (
          <div className="space-y-4">
            <div className="text-center">
              <div
                className={`text-4xl font-bold mb-2 ${getThemeColor(
                  userSide === "light" ? "blue" : "red"
                )}`}
              >
                {mockData.karmaScore.toLocaleString()}
              </div>
              <div className="text-gray-400">Karma Points</div>
              <div
                className={`text-lg font-medium mt-1 ${getThemeColor(
                  userSide === "light" ? "blue" : "red"
                )}`}
              >
                {mockData.rank} Rank
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {Object.entries(mockData.impact).map(([key, value]) => (
                <div
                  key={key}
                  className="bg-gray-800/50 rounded-lg p-3 text-center"
                >
                  <div className="text-white font-medium text-lg">{value}</div>
                  <div className="text-xs text-gray-400">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "contributions" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Contribution Breakdown</h3>
            {mockData.contributions.map((contrib, index) => (
              <div key={index} className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-white font-medium">{contrib.type}</div>
                  <div
                    className={`px-2 py-1 rounded text-xs ${getThemeBg(
                      userSide === "light" ? "blue" : "red"
                    )}`}
                  >
                    {contrib.points} pts
                  </div>
                </div>
                <div className="text-sm text-gray-400">{contrib.activity}</div>
              </div>
            ))}

            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Next Milestone</h3>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Progress to next rank</span>
                <span className="text-white">8750 / 10000</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full bg-${
                    userSide === "light" ? "blue" : "red"
                  }-600`}
                  style={{ width: "87.5%" }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "achievements" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Achievements</h3>
            {mockData.achievements.map((achievement, index) => (
              <div key={index} className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-start space-x-3">
                  <Star className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-white font-medium">
                      {achievement.name}
                    </div>
                    <div className="text-sm text-gray-400 mb-1">
                      {achievement.description}
                    </div>
                    <div className="text-xs text-gray-500">
                      Earned: {achievement.earned}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">
                Available Challenges
              </h3>
              <div className="space-y-2">
                {[
                  { task: "Publish 5 more guides", points: 500 },
                  { task: "Help 20 more developers", points: 800 },
                ].map((challenge, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center"
                  >
                    <span className="text-gray-300 text-sm">
                      {challenge.task}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${getThemeBg(
                        userSide === "light" ? "blue" : "red"
                      )}`}
                    >
                      +{challenge.points} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
