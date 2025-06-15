"use client";

import { useState } from "react";
import { Github, GitBranch, Star, Users, Activity } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useProjectData } from "@/hooks/use-project-data";
import { getAgentDisplayName } from "@/utils/agentUtils";

interface GitHubAgentProps {
  userSide: "light" | "dark" | null;
}

const extractValue = (obj: { "%share": string }) => obj["%share"];

export default function GitHubAgent({ userSide }: GitHubAgentProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const { projectId } = useAppStore();
  const { currentProject: data } = useProjectData(projectId || "");
  const agentId = "github";

  // Mock data matching schema
  const githubData = {
    _id: "gh-001",
    name: { "%share": data?.repo || "masumi-ai" },
    description: {
      "%share": data?.summary || "AI-powered development assistant",
    },
    technical_description: {
      "%share":
        data?.technicalDescription ||
        "React/TypeScript application with AI integration",
    },
    repo_url: {
      "%share": `https://github.com/${
        data?.developers?.[0]?.github_username || "user"
      }/${data?.repo || "project"}`,
    },
    owner: { "%share": data?.developers?.[0]?.github_username || "developer" },
    collab: { "%share": JSON.stringify(data?.developers || []) },
    owner_address: { "%share": "0x1234567890abcdef" },
    metadata: {
      "%share": JSON.stringify({
        stars: 42,
        forks: data?.technicalSummary?.includes("fork") ? 1 : 0,
        issues: 5,
        prs: 3,
        languages: data?.ipMetadata?.programmingLanguages?.map(
          (lang: any) => lang.S
        ) || ["TypeScript", "JavaScript"],
        license: data?.ipMetadata?.license?.S || "MIT",
        lastCommit: data?.updatedAt || "2025-06-14",
      }),
    },
  };

  const repoInfo = {
    name: extractValue(githubData.name),
    description: extractValue(githubData.description),
    technical_description: extractValue(githubData.technical_description),
    repo_url: extractValue(githubData.repo_url),
    owner: extractValue(githubData.owner),
    metadata: JSON.parse(extractValue(githubData.metadata)),
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
              <div className="flex items-center space-x-2 text-stone-300 mb-2">
                <Github className="w-4 h-4" />
                <span>
                  {repoInfo.owner}/{repoInfo.name}
                </span>
              </div>
              <p className="text-sm text-stone-400">{repoInfo.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className="text-white font-medium">
                    {repoInfo.metadata.stars}
                  </span>
                </div>
                <p className="text-xs text-stone-400">Stars</p>
              </div>

              <div className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <GitBranch className="w-4 h-4 text-green-400" />
                  <span className="text-white font-medium">
                    {repoInfo.metadata.forks}
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
                  <span className="text-stone-400">Open Issues</span>
                  <span className="text-white">{repoInfo.metadata.issues}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Pull Requests</span>
                  <span className="text-white">{repoInfo.metadata.prs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Last Commit</span>
                  <span className="text-white">
                    {repoInfo.metadata.lastCommit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">License</span>
                  <span className="text-white">
                    {repoInfo.metadata.license}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-stone-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Languages</h3>
              <div className="flex flex-wrap gap-2">
                {repoInfo.metadata.languages.map((lang: string) => (
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
            <div className="bg-stone-800/50 rounded-lg p-3 flex items-start space-x-3">
              <Activity className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-stone-300 text-sm">
                {repoInfo.technical_description}
              </span>
            </div>
            <div className="bg-stone-800/50 rounded-lg p-3 flex items-start space-x-3">
              <Activity className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <span className="text-stone-300 text-sm">
                Repository maintained by {repoInfo.owner}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
