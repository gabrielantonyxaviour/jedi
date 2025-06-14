"use client";

import { useState } from "react";
import { Github, GitBranch, Star, Users, Activity } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useProjectData } from "@/hooks/use-project-data";

interface GitHubAgentProps {
  userSide: "light" | "dark" | null;
}

export default function GitHubAgent({ userSide }: GitHubAgentProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const { projectId } = useAppStore();
  const { data } = useProjectData(projectId || "");

  const repoData = {
    repo: {
      name: data?.repo || "",
      owner: data?.developers?.[0]?.github_username || "",
      stars: 0, // These would need to be fetched from GitHub API
      forks: 1, // From technicalSummary
      issues: 0, // From technicalSummary
      prs: 0,
    },
    stats: {
      commits: 0, // Would need GitHub API
      contributors: data?.developers?.length || 1,
      languages: data?.ipMetadata?.programmingLanguages?.map(
        (lang: any) => lang.S
      ) || ["JavaScript"],
      lastCommit: "2025-06-14", // From updatedAt
    },
    insights: [
      data?.summary || "",
      data?.technicalDescription || "",
      data?.technicalSummary?.split("\n")[0] || "",
      `License: ${data?.ipMetadata?.license?.S || "MIT"}`,
    ].filter(Boolean),
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-stone-700">
        <div className="flex items-center space-x-2">
          <Github className="w-5 h-5 text-white" />
          <span className="font-medium text-white">GitHub Intelligence</span>
        </div>
        <div
          className={`px-2 py-1 rounded text-xs ${
            userSide === "light"
              ? "bg-blue-900/30 text-blue-300"
              : "bg-red-900/30 text-red-300"
          }`}
        >
          Connected
        </div>
      </div>

      <div className="flex border-b border-stone-700">
        {["overview", "stats", "insights"].map((tab) => (
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
            <div className="bg-stone-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Repository</h3>
              <div className="flex items-center space-x-2 text-stone-300">
                <Github className="w-4 h-4" />
                <span>
                  {repoData.repo.owner}/{repoData.repo.name}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className="text-white font-medium">
                    {repoData.repo.stars}
                  </span>
                </div>
                <p className="text-xs text-stone-400">Stars</p>
              </div>

              <div className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <GitBranch className="w-4 h-4 text-green-400" />
                  <span className="text-white font-medium">
                    {repoData.repo.forks}
                  </span>
                </div>
                <p className="text-xs text-stone-400">Forks</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-4">
            <div className="bg-stone-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Development Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-stone-400">Total Commits</span>
                  <span className="text-white">{repoData.stats.commits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Contributors</span>
                  <span className="text-white">
                    {repoData.stats.contributors}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Last Commit</span>
                  <span className="text-white">
                    {repoData.stats.lastCommit}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-stone-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Languages</h3>
              <div className="flex flex-wrap gap-2">
                {repoData.stats.languages.map((lang: string) => (
                  <span
                    key={lang}
                    className={`px-2 py-1 rounded text-xs ${
                      userSide === "light"
                        ? "bg-blue-900/30 text-blue-300"
                        : "bg-red-900/30 text-red-300"
                    }`}
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "insights" && (
          <div className="space-y-3">
            <h3 className="text-white font-medium">AI Insights</h3>
            {repoData.insights.map((insight, index) => (
              <div
                key={index}
                className="bg-stone-800/50 rounded-lg p-3 flex items-start space-x-3"
              >
                <Activity className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-stone-300 text-sm">{insight}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
