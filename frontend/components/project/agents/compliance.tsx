"use client";

import { useState } from "react";
import { FileText, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { getAgentDisplayName } from "@/utils/agentUtils";

interface ComplianceAgentProps {
  userSide: "light" | "dark" | null;
}

export default function ComplianceAgent({ userSide }: ComplianceAgentProps) {
  const [activeTab, setActiveTab] = useState("status");
  const agentId = "compliance";

  const mockData = {
    regulations: [
      {
        name: "SOC 2",
        status: "Compliant",
        lastAudit: "2024-01-15",
        nextDue: "2024-07-15",
      },
      {
        name: "ISO 27001",
        status: "In Progress",
        lastAudit: "2023-12-01",
        nextDue: "2024-06-01",
      },
      {
        name: "GDPR",
        status: "Compliant",
        lastAudit: "2024-02-01",
        nextDue: "2024-08-01",
      },
    ],
    policies: [
      { name: "Privacy Policy", status: "Updated", lastReview: "2024-03-01" },
      {
        name: "Terms of Service",
        status: "Needs Review",
        lastReview: "2023-11-15",
      },
      { name: "Cookie Policy", status: "Updated", lastReview: "2024-02-20" },
    ],
    tasks: [
      {
        task: "Update data retention policy",
        priority: "High",
        dueDate: "2024-06-20",
      },
      {
        task: "Review vendor agreements",
        priority: "Medium",
        dueDate: "2024-07-01",
      },
      {
        task: "Conduct security training",
        priority: "Low",
        dueDate: "2024-08-15",
      },
    ],
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-stone-700">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-white" />
          <span className="font-medium text-white">Compliance Agent</span>
        </div>
        <div
          className={`px-2 py-1 rounded text-xs ${
            userSide === "light"
              ? "bg-blue-900/30 text-blue-300"
              : "bg-red-900/30 text-red-300"
          }`}
        >
          Monitoring
        </div>
      </div>

      <div className="flex border-b border-stone-700">
        {["status", "policies", "tasks"].map((tab) => (
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
        {activeTab === "status" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Compliance Status</h3>
            {mockData.regulations.map((reg, index) => (
              <div key={index} className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-white font-medium">{reg.name}</div>
                  <div className="flex items-center space-x-2">
                    {reg.status === "Compliant" ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-400" />
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        reg.status === "Compliant"
                          ? "bg-green-900/30 text-green-300"
                          : "bg-yellow-900/30 text-yellow-300"
                      }`}
                    >
                      {reg.status}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-stone-400">
                  Last audit: {reg.lastAudit} • Next due: {reg.nextDue}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "policies" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Policy Documents</h3>
            {mockData.policies.map((policy, index) => (
              <div key={index} className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-white font-medium">{policy.name}</div>
                  <div className="flex items-center space-x-2">
                    {policy.status === "Updated" ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        policy.status === "Updated"
                          ? "bg-green-900/30 text-green-300"
                          : "bg-red-900/30 text-red-300"
                      }`}
                    >
                      {policy.status}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-stone-400">
                  Last review: {policy.lastReview}
                </div>
                <button
                  className={`mt-2 px-3 py-1 rounded text-xs ${
                    userSide === "light"
                      ? "bg-blue-600 text-white"
                      : "bg-red-600 text-white"
                  }`}
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-4">
            <h3 className="text-white font-medium">Compliance Tasks</h3>
            {mockData.tasks.map((task, index) => (
              <div key={index} className="bg-stone-800/50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-white font-medium">{task.task}</div>
                  <div
                    className={`px-2 py-1 rounded text-xs ${
                      task.priority === "High"
                        ? "bg-red-900/30 text-red-300"
                        : task.priority === "Medium"
                        ? "bg-yellow-900/30 text-yellow-300"
                        : "bg-green-900/30 text-green-300"
                    }`}
                  >
                    {task.priority}
                  </div>
                </div>
                <div className="text-sm text-stone-400 mb-2">
                  Due: {task.dueDate}
                </div>
                <button
                  className={`px-3 py-1 rounded text-xs ${
                    userSide === "light"
                      ? "bg-blue-600 text-white"
                      : "bg-red-600 text-white"
                  }`}
                >
                  Start Task
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
