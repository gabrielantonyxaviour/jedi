interface ChangeAnalysis {
    type: "feature" | "bugfix" | "refactor" | "config" | "docs" | "test" | "dependency" | "infrastructure";
    impact: "major" | "minor" | "patch";
    files: string[];
    summary: string;
}
interface RepoAnalysis {
    metadata: {
        name: string;
        description: string;
        language: string;
        framework: string[];
        techStack: string[];
        size: number;
        stars: number;
        lastUpdated: string;
        homepage?: string;
        license?: string;
    };
    structure: {
        directories: string[];
        keyFiles: string[];
        architecture: string;
    };
    activity: {
        totalCommits: number;
        recentChanges: ChangeAnalysis[];
        contributors: number;
        releaseFrequency: string;
        lastCommit: string;
    };
    codeInsights: {
        languages: Record<string, number>;
        testCoverage: boolean;
        ciCd: boolean;
        documentation: "excellent" | "good" | "basic" | "poor";
    };
}
declare class UniversalGitHubAgent {
    private octokit;
    private localStoragePath;
    constructor();
    analyzeRepository(repoUrl: string): Promise<RepoAnalysis>;
    private fetchRepoInfo;
    private fetchSignificantCommits;
    private fetchContributors;
    private fetchLanguages;
    private fetchReleases;
    private analyzeRepoStructure;
    private fetchSingleFile;
    private scanDirectory;
    private analyzeCommitChanges;
    private classifyCommit;
    private generateChangeSummary;
    private detectTechStack;
    private extractDependencies;
    private determineArchitecture;
    private hasTestCoverage;
    private hasCICD;
    private assessDocumentation;
    private analyzeReleaseFrequency;
    private isTrivialCommit;
    private isKeyFile;
    private isImportantFile;
    private getImportantDirectories;
    private parseRepoUrl;
    private createLocalDirectories;
    private storeAnalysis;
    private generateMarkdownSummary;
}
export { UniversalGitHubAgent, RepoAnalysis };
