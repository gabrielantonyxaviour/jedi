import { Octokit } from "@octokit/rest";
import * as fs from "fs/promises";
import * as path from "path";
class UniversalGitHubAgent {
    octokit;
    localStoragePath;
    constructor() {
        this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        this.localStoragePath = path.join(process.cwd(), "local-storage");
    }
    async analyzeRepository(repoUrl) {
        const { owner, repo } = this.parseRepoUrl(repoUrl);
        console.log(`🔍 Analyzing ${owner}/${repo} (Universal Analysis)...`);
        // Parallel data fetching for speed
        const [repoInfo, commits, contributors, languages, releases, structure] = await Promise.all([
            this.fetchRepoInfo(owner, repo),
            this.fetchSignificantCommits(owner, repo, 20),
            this.fetchContributors(owner, repo),
            this.fetchLanguages(owner, repo),
            this.fetchReleases(owner, repo),
            this.analyzeRepoStructure(owner, repo),
        ]);
        // Analyze changes intelligently
        const changeAnalysis = await this.analyzeCommitChanges(commits.commits);
        // Detect tech stack universally
        const techStack = this.detectTechStack(structure.keyFiles, languages);
        // Build comprehensive analysis
        const analysis = {
            metadata: {
                name: repoInfo.name,
                description: repoInfo.description || "No description",
                language: repoInfo.language || "Unknown",
                framework: techStack.frameworks,
                techStack: techStack.technologies,
                size: repoInfo.size,
                stars: repoInfo.stargazers_count,
                lastUpdated: repoInfo.updated_at,
                homepage: repoInfo.homepage || undefined,
                license: repoInfo.license?.name,
            },
            structure: {
                directories: structure.directories,
                keyFiles: structure.keyFiles.map((f) => f.name),
                architecture: this.determineArchitecture(structure),
            },
            activity: {
                totalCommits: commits.totalCommits,
                recentChanges: changeAnalysis,
                contributors: contributors.length,
                releaseFrequency: this.analyzeReleaseFrequency(releases),
                lastCommit: commits.commits[0]?.date || "Unknown",
            },
            codeInsights: {
                languages,
                testCoverage: this.hasTestCoverage(structure.keyFiles),
                ciCd: this.hasCICD(structure.keyFiles),
                documentation: this.assessDocumentation(structure.keyFiles),
            },
        };
        // Store single comprehensive JSON
        await this.createLocalDirectories(owner, repo);
        await this.storeAnalysis(owner, repo, analysis);
        console.log(`✅ Complete analysis stored for ${owner}/${repo}`);
        return analysis;
    }
    async fetchRepoInfo(owner, repo) {
        console.log("📋 Fetching repository info...");
        const { data } = await this.octokit.rest.repos.get({ owner, repo });
        return data;
    }
    async fetchSignificantCommits(owner, repo, count) {
        console.log(`📝 Fetching up to ${count} significant commits...`);
        // Step 1: Estimate total commit count using pagination header
        const { headers } = await this.octokit.rest.repos.listCommits({
            owner,
            repo,
            per_page: 1,
        });
        const totalCommits = headers["link"]
            ? parseInt(/&page=(\d+)>; rel="last"/.exec(headers["link"])?.[1] || "1")
            : 1;
        const significantCommits = [];
        let page = 1;
        const perPage = 100;
        let fetchedAll = false;
        // Step 2: Paginate through commits
        while (significantCommits.length < count && !fetchedAll) {
            const { data: commits } = await this.octokit.rest.repos.listCommits({
                owner,
                repo,
                per_page: perPage,
                page,
            });
            if (commits.length === 0) {
                fetchedAll = true;
                break;
            }
            for (const commit of commits) {
                if (significantCommits.length >= count)
                    break;
                if (this.isTrivialCommit(commit.commit.message))
                    continue;
                try {
                    const { data: detailed } = await this.octokit.rest.repos.getCommit({
                        owner,
                        repo,
                        ref: commit.sha,
                    });
                    if (detailed.stats &&
                        detailed.stats.total &&
                        detailed.stats.total > 0) {
                        significantCommits.push({
                            sha: commit.sha,
                            message: commit.commit.message,
                            author: commit.commit.author?.name,
                            date: commit.commit.author?.date,
                            stats: detailed.stats,
                            files: detailed.files?.slice(0, 20).map((f) => ({
                                filename: f.filename,
                                status: f.status,
                                additions: f.additions,
                                deletions: f.deletions,
                            })) || [],
                        });
                    }
                    await new Promise((resolve) => setTimeout(resolve, 200));
                }
                catch (error) {
                    console.log(`⚠️ Skipped commit ${commit.sha.slice(0, 7)}`);
                }
            }
            page++;
        }
        console.log(`✓ Found ${significantCommits.length} significant commits`);
        return {
            commits: significantCommits,
            totalCommits,
        };
    }
    async fetchContributors(owner, repo) {
        console.log("👥 Fetching contributors...");
        try {
            const { data } = await this.octokit.rest.repos.listContributors({
                owner,
                repo,
                per_page: 20,
            });
            return data.map((contributor) => ({
                login: contributor.login,
                contributions: contributor.contributions,
                type: contributor.type,
            }));
        }
        catch (error) {
            return [];
        }
    }
    async fetchLanguages(owner, repo) {
        console.log("🔧 Fetching languages...");
        try {
            const { data } = await this.octokit.rest.repos.listLanguages({
                owner,
                repo,
            });
            return data;
        }
        catch (error) {
            return {};
        }
    }
    async fetchReleases(owner, repo) {
        console.log("🚀 Fetching releases...");
        try {
            const { data } = await this.octokit.rest.repos.listReleases({
                owner,
                repo,
                per_page: 10,
            });
            return data.map((release) => ({
                name: release.name,
                tagName: release.tag_name,
                body: release.body,
                publishedAt: release.published_at,
                prerelease: release.prerelease,
            }));
        }
        catch (error) {
            return [];
        }
    }
    async analyzeRepoStructure(owner, repo) {
        console.log("🏗️ Analyzing repository structure...");
        try {
            const { data: contents } = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path: "",
            });
            if (!Array.isArray(contents))
                return { directories: [], keyFiles: [] };
            const directories = contents
                .filter((item) => item.type === "dir")
                .map((d) => d.name);
            // Get key files from root
            const keyFiles = [];
            for (const item of contents.filter((i) => i.type === "file")) {
                if (this.isKeyFile(item.name)) {
                    const file = await this.fetchSingleFile(owner, repo, item.name);
                    if (file)
                        keyFiles.push(file);
                }
            }
            // Scan important directories
            const importantDirs = this.getImportantDirectories(directories);
            for (const dir of importantDirs.slice(0, 3)) {
                const dirFiles = await this.scanDirectory(owner, repo, dir, 3);
                keyFiles.push(...dirFiles);
            }
            console.log(`   📁 Found ${directories.length} directories, ${keyFiles.length} key files`);
            return { directories, keyFiles };
        }
        catch (error) {
            console.log("   ⚠️ Could not analyze structure");
            return { directories: [], keyFiles: [] };
        }
    }
    async fetchSingleFile(owner, repo, filePath) {
        try {
            const { data } = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath,
            });
            if ("content" in data && data.type === "file") {
                console.log(`     ✓ Found ${filePath} (${data.size} bytes)`);
                return {
                    name: filePath,
                    content: Buffer.from(data.content, "base64").toString("utf8"),
                    size: data.size,
                    sha: data.sha,
                };
            }
        }
        catch (error) {
            // File doesn't exist
        }
        return null;
    }
    async scanDirectory(owner, repo, dirPath, maxFiles = 3) {
        try {
            console.log(`   🔍 Scanning ${dirPath}/...`);
            const { data } = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path: dirPath,
            });
            if (!Array.isArray(data))
                return [];
            const files = [];
            let fileCount = 0;
            for (const item of data) {
                if (fileCount >= maxFiles)
                    break;
                if (item.type === "file" && this.isImportantFile(item.name)) {
                    const file = await this.fetchSingleFile(owner, repo, item.path);
                    if (file) {
                        files.push(file);
                        fileCount++;
                    }
                }
            }
            console.log(`     📁 Found ${files.length} files in ${dirPath}/`);
            return files;
        }
        catch (error) {
            return [];
        }
    }
    async analyzeCommitChanges(commits) {
        console.log("🔬 Analyzing commit changes...");
        return commits.map((commit) => {
            const { type, impact } = this.classifyCommit(commit);
            return {
                type,
                impact,
                files: commit.files?.map((f) => f.filename) || [],
                summary: this.generateChangeSummary(commit, type, impact),
            };
        });
    }
    classifyCommit(commit) {
        const message = commit.message.toLowerCase();
        const files = commit.files || [];
        const totalChanges = commit.stats?.total || 0;
        // Determine type
        let type = "feature";
        if (message.includes("fix") || message.includes("bug"))
            type = "bugfix";
        else if (message.includes("refactor") || message.includes("restructure"))
            type = "refactor";
        else if (message.includes("test") ||
            files.some((f) => f.filename.includes("test")))
            type = "test";
        else if (message.includes("doc") ||
            files.some((f) => f.filename.includes("README") || f.filename.includes(".md")))
            type = "docs";
        else if (files.some((f) => f.filename.includes("package.json") ||
            f.filename.includes("requirements") ||
            f.filename.includes("pom.xml")))
            type = "dependency";
        else if (files.some((f) => f.filename.includes("config") ||
            f.filename.includes(".yml") ||
            f.filename.includes(".yaml")))
            type = "config";
        else if (files.some((f) => f.filename.includes("docker") ||
            f.filename.includes("deploy") ||
            f.filename.includes(".tf")))
            type = "infrastructure";
        // Determine impact
        let impact = "patch";
        if (totalChanges > 500 ||
            message.includes("breaking") ||
            message.includes("major"))
            impact = "major";
        else if (totalChanges > 100 ||
            message.includes("feat") ||
            files.length > 10)
            impact = "minor";
        return { type, impact };
    }
    generateChangeSummary(commit, type, impact) {
        const fileCount = commit.files?.length || 0;
        const additions = commit.stats?.additions || 0;
        const deletions = commit.stats?.deletions || 0;
        return `[${type.toUpperCase()}] ${commit.message.split("\n")[0]} | ${fileCount} files | +${additions} -${deletions} | Impact: ${impact}`;
    }
    detectTechStack(keyFiles, languages) {
        const frameworks = [];
        const technologies = [];
        keyFiles.forEach((file) => {
            const name = file.name.toLowerCase();
            const content = file.content || "";
            // Package managers and frameworks
            if (name.includes("package.json")) {
                const deps = this.extractDependencies(content);
                technologies.push("Node.js");
                if (deps.includes("next"))
                    frameworks.push("Next.js");
                if (deps.includes("react"))
                    frameworks.push("React");
                if (deps.includes("vue"))
                    frameworks.push("Vue.js");
                if (deps.includes("angular"))
                    frameworks.push("Angular");
                if (deps.includes("express"))
                    frameworks.push("Express.js");
                if (deps.includes("fastify"))
                    frameworks.push("Fastify");
                if (deps.includes("nuxt"))
                    frameworks.push("Nuxt.js");
                if (deps.includes("svelte"))
                    frameworks.push("Svelte");
            }
            if (name.includes("requirements.txt") ||
                name.includes("pyproject.toml")) {
                technologies.push("Python");
                if (content.includes("django"))
                    frameworks.push("Django");
                if (content.includes("flask"))
                    frameworks.push("Flask");
                if (content.includes("fastapi"))
                    frameworks.push("FastAPI");
            }
            if (name.includes("cargo.toml")) {
                technologies.push("Rust");
                if (content.includes("actix"))
                    frameworks.push("Actix");
                if (content.includes("rocket"))
                    frameworks.push("Rocket");
            }
            if (name.includes("go.mod")) {
                technologies.push("Go");
                if (content.includes("gin"))
                    frameworks.push("Gin");
                if (content.includes("echo"))
                    frameworks.push("Echo");
            }
            if (name.includes("gemfile")) {
                technologies.push("Ruby");
                if (content.includes("rails"))
                    frameworks.push("Ruby on Rails");
            }
            if (name.includes("composer.json")) {
                technologies.push("PHP");
                if (content.includes("laravel"))
                    frameworks.push("Laravel");
                if (content.includes("symfony"))
                    frameworks.push("Symfony");
            }
            if (name.includes("pom.xml") || name.includes("build.gradle")) {
                technologies.push("Java");
                if (content.includes("spring"))
                    frameworks.push("Spring Boot");
            }
            // Infrastructure
            if (name.includes("docker"))
                technologies.push("Docker");
            if (name.includes("kubernetes") || name.includes("k8s"))
                technologies.push("Kubernetes");
            if (name.includes(".tf"))
                technologies.push("Terraform");
        });
        // Add detected languages
        Object.keys(languages).forEach((lang) => {
            if (!technologies.includes(lang)) {
                technologies.push(lang);
            }
        });
        return {
            frameworks: [...new Set(frameworks)],
            technologies: [...new Set(technologies)],
        };
    }
    extractDependencies(packageJson) {
        try {
            const pkg = JSON.parse(packageJson);
            return [
                ...Object.keys(pkg.dependencies || {}),
                ...Object.keys(pkg.devDependencies || {}),
            ];
        }
        catch {
            return [];
        }
    }
    determineArchitecture(structure) {
        const { directories, keyFiles } = structure;
        const dirs = directories.map((d) => d.toLowerCase());
        const files = keyFiles.map((f) => f.name.toLowerCase());
        if (dirs.includes("app") &&
            files.some((f) => f.includes("next.config")))
            return "Next.js App Router";
        if (dirs.includes("pages") &&
            files.some((f) => f.includes("next.config")))
            return "Next.js Pages Router";
        if (dirs.includes("src") && dirs.includes("public"))
            return "Frontend SPA";
        if (dirs.includes("server") && dirs.includes("client"))
            return "Full-stack Monorepo";
        if (dirs.includes("api") || dirs.includes("routes"))
            return "Backend API";
        if (files.some((f) => f.includes("docker-compose")))
            return "Microservices";
        if (dirs.includes("lib") && dirs.includes("src"))
            return "Library/Package";
        return "Standard Repository";
    }
    hasTestCoverage(keyFiles) {
        return keyFiles.some((f) => f.name.toLowerCase().includes("test") ||
            f.name.toLowerCase().includes("spec") ||
            f.content?.includes("jest") ||
            f.content?.includes("cypress") ||
            f.content?.includes("pytest"));
    }
    hasCICD(keyFiles) {
        return keyFiles.some((f) => f.name.includes(".github") ||
            f.name.includes(".gitlab-ci") ||
            f.name.includes("jenkins") ||
            f.name.includes(".circleci"));
    }
    assessDocumentation(keyFiles) {
        const readmeFile = keyFiles.find((f) => f.name.toLowerCase().includes("readme"));
        if (!readmeFile)
            return "poor";
        const content = readmeFile.content || "";
        const hasChangelog = keyFiles.some((f) => f.name.toLowerCase().includes("changelog"));
        const hasContributing = keyFiles.some((f) => f.name.toLowerCase().includes("contributing"));
        if (content.length > 2000 && hasChangelog && hasContributing)
            return "excellent";
        if (content.length > 1000 && (hasChangelog || hasContributing))
            return "good";
        if (content.length > 500)
            return "basic";
        return "poor";
    }
    analyzeReleaseFrequency(releases) {
        if (releases.length === 0)
            return "No releases";
        if (releases.length === 1)
            return "Single release";
        const latestRelease = new Date(releases[0].publishedAt);
        const oldestRelease = new Date(releases[releases.length - 1].publishedAt);
        const monthsDiff = (latestRelease.getTime() - oldestRelease.getTime()) /
            (1000 * 60 * 60 * 24 * 30);
        const frequency = releases.length / monthsDiff;
        if (frequency > 1)
            return "Very frequent (>1/month)";
        if (frequency > 0.5)
            return "Frequent (bi-monthly)";
        if (frequency > 0.25)
            return "Regular (quarterly)";
        return "Infrequent (<quarterly)";
    }
    isTrivialCommit(message) {
        const trivialPatterns = [
            /^merge/i,
            /^bump version/i,
            /^update readme/i,
            /^fix typo/i,
            /^formatting/i,
            /^whitespace/i,
        ];
        return trivialPatterns.some((pattern) => pattern.test(message));
    }
    isKeyFile(filename) {
        const keyFiles = [
            "package.json",
            "requirements.txt",
            "cargo.toml",
            "go.mod",
            "gemfile",
            "composer.json",
            "dockerfile",
            "docker-compose.yml",
            "readme.md",
            "license",
            "makefile",
            "tsconfig.json",
            "next.config.js",
            "webpack.config.js",
            "vite.config.js",
            ".env.example",
            "pyproject.toml",
            "setup.py",
            "pom.xml",
            "build.gradle",
        ];
        return keyFiles.some((key) => filename.toLowerCase().includes(key));
    }
    isImportantFile(filename) {
        const extensions = [
            ".tsx",
            ".jsx",
            ".ts",
            ".js",
            ".py",
            ".rs",
            ".go",
            ".rb",
            ".php",
            ".java",
        ];
        const important = [
            "index",
            "main",
            "app",
            "server",
            "client",
            "config",
            "utils",
        ];
        return (extensions.some((ext) => filename.endsWith(ext)) &&
            important.some((imp) => filename.toLowerCase().includes(imp)));
    }
    getImportantDirectories(directories) {
        const priority = [
            "src",
            "app",
            "lib",
            "components",
            "pages",
            "api",
            "server",
            "client",
            "public",
            "static",
            "utils",
            "hooks",
        ];
        return directories.filter((dir) => priority.includes(dir.toLowerCase()));
    }
    parseRepoUrl(url) {
        const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!match)
            throw new Error("Invalid GitHub URL");
        return { owner: match[1], repo: match[2].replace(".git", "") };
    }
    async createLocalDirectories(owner, repo) {
        const repoPath = path.join(this.localStoragePath, owner, repo);
        await fs.mkdir(repoPath, { recursive: true });
    }
    async storeAnalysis(owner, repo, analysis) {
        const filePath = path.join(this.localStoragePath, owner, repo, "complete-analysis.json");
        await fs.writeFile(filePath, JSON.stringify(analysis, null, 2));
        console.log(`💾 Stored complete analysis: ${filePath}`);
        // Also create a human-readable summary
        const summaryPath = path.join(this.localStoragePath, owner, repo, "summary.md");
        await fs.writeFile(summaryPath, this.generateMarkdownSummary(analysis));
        console.log(`📋 Created summary: ${summaryPath}`);
    }
    generateMarkdownSummary(analysis) {
        return `# ${analysis.metadata.name}

## Overview
- **Description**: ${analysis.metadata.description}
- **Primary Language**: ${analysis.metadata.language}
- **Stars**: ${analysis.metadata.stars}
- **Last Updated**: ${new Date(analysis.metadata.lastUpdated).toLocaleDateString()}
- **Architecture**: ${analysis.structure.architecture}

## Tech Stack
**Frameworks**: ${analysis.metadata.framework.join(", ") || "None detected"}
**Technologies**: ${analysis.metadata.techStack.join(", ")}

## Recent Activity
- **Total Commits**: ${analysis.activity.totalCommits}
- **Contributors**: ${analysis.activity.contributors}
- **Release Frequency**: ${analysis.activity.releaseFrequency}

## Recent Changes
${analysis.activity.recentChanges
            .map((change) => `- **${change.type.toUpperCase()}** (${change.impact}): ${change.files.length} files modified`)
            .join("\n")}

## Code Quality
- **Test Coverage**: ${analysis.codeInsights.testCoverage ? "✅ Present" : "❌ Not detected"}
- **CI/CD**: ${analysis.codeInsights.ciCd ? "✅ Present" : "❌ Not detected"}  
- **Documentation**: ${analysis.codeInsights.documentation}

## Key Files
${analysis.structure.keyFiles
            .slice(0, 10)
            .map((file) => `- ${file}`)
            .join("\n")}
`;
    }
}
export { UniversalGitHubAgent };
