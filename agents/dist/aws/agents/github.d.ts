interface RepoData {
    owner: string;
    repo: string;
    lastAnalyzed: string;
    summary?: string;
}
declare class GitHubIntelligenceAgent {
    private octokit;
    private dynamodb;
    private s3;
    constructor();
    analyzeRepository(repoUrl: string): Promise<RepoData>;
    private fetchRepositoryInfo;
    private fetchRecentCommits;
    private fetchImportantFiles;
    private generateBasicSummary;
    private extractTechStack;
    private storeRepoData;
    private storeDetailedData;
    private parseRepoUrl;
    handleWebhook(webhookData: any): Promise<void>;
}
export { GitHubIntelligenceAgent };
