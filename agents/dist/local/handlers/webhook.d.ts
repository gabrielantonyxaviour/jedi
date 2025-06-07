import { Request, Response } from "express";
import { UniversalGitHubAgent } from "../agents/github";
import { ProjectDataManager } from "../managers/project-data";
export declare class WebhookHandler {
    private octokit;
    private githubAgent;
    private dataManager;
    constructor(githubAgent: UniversalGitHubAgent, dataManager: ProjectDataManager);
    registerWebhook(repoUrl: string): Promise<string>;
    handleWebhook(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    private handlePushEvent;
    private calculateSignificance;
    private fetchCommitDetails;
    private parseRepoUrl;
}
