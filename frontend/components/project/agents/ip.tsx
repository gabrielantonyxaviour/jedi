"use client";

import { useState } from "react";
import { Shield, FileText, AlertTriangle, CheckCircle } from "lucide-react";

interface IPAgentProps {
  userSide: "light" | "dark" | null;
}

export default function IPAgent({ userSide }: IPAgentProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const mockData = {
    patents: [
      {
        title: "AI-powered Code Analysis",
        status: "Filed",
        date: "2024-01-15",
      },
      {
        title: "Distributed Computing Method",
        status: "Pending",
        date: "2024-03-22",
      },
    ],
    trademarks: [
      { name: "MasumiAI", status: "Registered", class: "Software" },
      { name: "CodeGenius", status: "Applied", class: "AI Tools" },
    ],
    risks: [
      {
        type: "Copyright",
        level: "Low",
        description: "Open source dependencies review needed",
      },
      {
        type: "Patent",
        level: "Medium",
        description: "Similar patent found - needs analysis",
      },
    ],
    compliance: {
      gdpr: "Compliant",
      ccpa: "Compliant",
      opensource: "Under Review",
    },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-white" />
          <span className="font-medium text-white">IP Agent</span>
        </div>
        <div
          className={`px-2 py-1 rounded text-xs ${
            userSide === "light"
              ? "bg-blue-900/30 text-blue-300"
              : "bg-red-900/30 text-red-300"
          }`}
        >
          Protected
        </div>
      </div>

      <div className="flex border-b border-gray-700">
        {["overview", "patents", "risks"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize ${
              activeTab === tab
                ? userSide === "light"
                  ? "border-b-2 border-blue-500 text-blue-400"
                  : "border-b-2 border-red-500 text-red-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-white font-medium text-lg">
                  {mockData.patents.length}
                </div>
                <div className="text-xs text-gray-400">Patents</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-white font-medium text-lg">
                  {mockData.trademarks.length}
                </div>
                <div className="text-xs text-gray-400">Trademarks</div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Compliance Status</h3>
              <div className="space-y-2">
                {Object.entries(mockData.compliance).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-gray-400 uppercase">{key}</span>
                    <div className="flex items-center space-x-2">
                      {value === "Compliant" ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      )}
                      <span
                        className={`text-sm ${
                          value === "Compliant"
                            ? "text-green-400"
                            : "text-yellow-400"
                        }`}
                      >
                        {value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "patents" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <h3 className="text-white font-medium">Patent Applications</h3>
              {mockData.patents.map((patent, index) => (
                <div key={index} className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-white font-medium">
                        {patent.title}
                      </div>
                      <div className="text-sm text-gray-400">{patent.date}</div>
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs ${
                        patent.status === "Filed"
                          ? "bg-green-900/30 text-green-300"
                          : "bg-yellow-900/30 text-yellow-300"
                      }`}
                    >
                      {patent.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-white font-medium">Trademarks</h3>
              {mockData.trademarks.map((trademark, index) => (
                <div key={index} className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-white font-medium">
                        {trademark.name}
                      </div>
                      <div className="text-sm text-gray-400">
                        {trademark.class}
                      </div>
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs ${
                        trademark.status === "Registered"
                          ? "bg-green-900/30 text-green-300"
                          : "bg-yellow-900/30 text-yellow-300"
                      }`}
                    >
                      {trademark.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "risks" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Risk Assessment</h3>
            {mockData.risks.map((risk, index) => (
              <div key={index} className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-white font-medium">{risk.type} Risk</div>
                  <div
                    className={`px-2 py-1 rounded text-xs ${
                      risk.level === "Low"
                        ? "bg-green-900/30 text-green-300"
                        : risk.level === "Medium"
                        ? "bg-yellow-900/30 text-yellow-300"
                        : "bg-red-900/30 text-red-300"
                    }`}
                  >
                    {risk.level}
                  </div>
                </div>
                <p className="text-sm text-gray-400">{risk.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
