import { BaseService } from "./base-service";
import { LogEntry, AgentName } from "../types";
import { SCHEMA_IDS } from "../config/nillion";
import { v4 as uuidv4 } from "uuid";

export class LogsService extends BaseService<LogEntry> {
  constructor() {
    super(SCHEMA_IDS.LOGS);
  }

  async createLog(
    projectId: string,
    agentName: AgentName,
    text: string,
    data: Record<string, any>
  ): Promise<string> {
    const logEntry: LogEntry = {
      id: uuidv4(),
      projectId,
      agentName,
      text,
      data,
    };

    const ids = await this.create([logEntry]);
    return ids[0];
  }

  async getLogsByProject(projectId: string): Promise<LogEntry[]> {
    return await this.findAll({ projectId });
  }

  async getLogsByAgent(agentName: AgentName): Promise<LogEntry[]> {
    return await this.findAll({ agentName });
  }

  async getLogsByProjectAndAgent(
    projectId: string,
    agentName: AgentName
  ): Promise<LogEntry[]> {
    return await this.findAll({ projectId, agentName });
  }

  // Analytics queries
  async getLogsCountByAgent(): Promise<any[]> {
    const pipeline = [
      {
        $group: {
          _id: "$agentName",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ];

    return await this.query(pipeline);
  }

  async getRecentLogsByProject(
    projectId: string,
    limit: number = 10
  ): Promise<LogEntry[]> {
    const pipeline = [
      {
        $match: { projectId },
      },
      {
        $sort: { _created: -1 },
      },
      {
        $limit: limit,
      },
    ];

    return await this.query(pipeline);
  }
}
