export declare class ProjectDataManager {
    private localStoragePath;
    constructor();
    getProjectData(owner: string, repo: string): Promise<{
        analysis: any;
        changeHistory: any;
        lastUpdated: string;
    } | null>;
    updateProjectWithCommit(owner: string, repo: string, commit: any): Promise<void>;
    private updateProjectMetadata;
    private calculateDetailedSignificance;
    private classifyCommitType;
    private classifyCommitImpact;
    private readJsonFile;
    private writeJsonFile;
}
