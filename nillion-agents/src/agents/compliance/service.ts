import puppeteer from "puppeteer";
import axios from "axios";
import { sleep } from "../../utils/helper";

export interface ScrapedComplianceProject {
  complianceId: string;
  originalProjectId: string;
  projectName: string;
  description: string;
  url: string;
  platform: string;
  hackathon?: string;
  tags: string[];
  similarity: number;
  status: string;
  source: string;
  discoveredAt: string;
  ownerAddress?: string;
  metadata: any;
}

export class ComplianceScrapingService {
  async scrapeProjects(
    project: any,
    sources: string[],
    maxResults: number
  ): Promise<ScrapedComplianceProject[]> {
    const allProjects: ScrapedComplianceProject[] = [];

    console.log(`🔍 Scraping for similar projects to: ${project.name}`);

    for (const source of sources) {
      try {
        let projects: ScrapedComplianceProject[] = [];
        switch (source) {
          case "all":
          case "ethglobal":
            projects = await this.scrapeETHGlobal(project);
            if (source !== "all") break;

          case "dorahacks":
            projects = [...projects, ...(await this.scrapeDoraHacks(project))];
            if (source !== "all") break;

          case "devfolio":
            projects = [...projects, ...(await this.scrapeDevfolio(project))];
            if (source !== "all") break;

          case "github":
            projects = [...projects, ...(await this.scrapeGitHub(project))];
            break;
        }

        allProjects.push(...projects);
        console.log(`✅ ${source}: Found ${projects.length} similar projects`);
      } catch (error) {
        console.error(`❌ ${source} scraping failed:`, error);
      }

      await sleep(2000); // Rate limiting between sources
    }

    return allProjects.slice(0, maxResults);
  }

  private async scrapeETHGlobal(
    project: any
  ): Promise<ScrapedComplianceProject[]> {
    console.log("🌐 Scraping ETHGlobal Showcase...");

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );

      await page.goto("https://ethglobal.com/showcase", {
        waitUntil: "networkidle0",
      });

      await page.waitForSelector('a[href*="/showcase/"]', {
        timeout: 10000,
      });

      const projects = await page.evaluate(() => {
        const projectLinks = document.querySelectorAll('a[href*="/showcase/"]');

        return Array.from(projectLinks)
          .slice(0, 30)
          .map((link) => {
            const titleEl = link.querySelector("h2");
            const descEl = link.querySelector("p");
            const hackathonEl = link.querySelector(
              '.bg-purple-300, [class*="purple"]'
            );

            const relativeUrl = link.getAttribute("href");
            const fullUrl = relativeUrl
              ? `https://ethglobal.com${relativeUrl}`
              : "";

            return {
              name: titleEl?.textContent?.trim() || "",
              description: descEl?.textContent?.trim() || "",
              hackathon: hackathonEl?.textContent?.trim() || "ETHGlobal",
              url: fullUrl,
              tags: [],
              platform: "ETHGlobal",
            };
          })
          .filter((p) => p.name && p.name.length > 2);
      });

      await browser.close();

      console.log(`Found ${projects.length} ETHGlobal projects`);
      return projects.map((p) =>
        this.createComplianceProject(p, "ethglobal", project.projectId)
      );
    } catch (error) {
      await browser.close();
      console.error("ETHGlobal scraping error:", error);
      return [];
    }
  }

  private async scrapeDoraHacks(
    project: any
  ): Promise<ScrapedComplianceProject[]> {
    console.log("🚀 Scraping DoraHacks BUIDL...");

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );

      await page.goto("https://dorahacks.io/buidl", {
        waitUntil: "networkidle0",
      });

      await page.waitForSelector('.buidl-card, a[href*="/buidl/"]', {
        timeout: 10000,
      });

      const projects = await page.evaluate(() => {
        const projectElements = document.querySelectorAll(
          'a[href*="/buidl/"], .buidl-card'
        );
        const results: any[] = [];

        projectElements.forEach((element, index) => {
          if (index >= 30) return;

          const linkEl =
            element.tagName === "A"
              ? element
              : element.querySelector('a[href*="/buidl/"]');

          const titleEl =
            element.querySelector('h6, h2, .font-semibold, [class*="title"]') ||
            linkEl?.querySelector("h6, h2, .font-semibold");

          const descEl =
            element.querySelector("p:not(.text-xs), .line-clamp-2") ||
            linkEl?.querySelector("p:not(.text-xs), .line-clamp-2");

          const tagsEls = element.querySelectorAll(
            '.bg-accent-bg, [class*="tag"], .rounded.py-0\\.5.px-1'
          );

          const title = titleEl?.textContent?.trim();
          const url = linkEl?.getAttribute("href");

          if (title && title.length > 2) {
            results.push({
              name: title,
              description: descEl?.textContent?.trim() || "",
              url: url?.startsWith("http") ? url : `https://dorahacks.io${url}`,
              tags: Array.from(tagsEls)
                .map((el) => el.textContent?.trim())
                .filter(Boolean),
              platform: "DoraHacks",
            });
          }
        });

        return results;
      });

      await browser.close();

      console.log(`Found ${projects.length} DoraHacks projects`);
      return projects.map((p) =>
        this.createComplianceProject(p, "dorahacks", project.projectId)
      );
    } catch (error) {
      await browser.close();
      console.error("DoraHacks scraping error:", error);
      return [];
    }
  }

  private async scrapeDevfolio(
    project: any
  ): Promise<ScrapedComplianceProject[]> {
    console.log("💼 Scraping Devfolio...");

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );

      await page.goto("https://devfolio.co/search?primary_filter=projects", {
        waitUntil: "networkidle0",
      });

      await page.waitForSelector('a[href*="/projects/"]', {
        timeout: 10000,
      });

      const projects = await page.evaluate(() => {
        const projectLinks = document.querySelectorAll('a[href*="/projects/"]');
        const results: any[] = [];

        projectLinks.forEach((link, index) => {
          if (index >= 30) return;

          const titleEl =
            link.querySelector("h6.sc-dkzDqf.fOhnMx") ||
            link.querySelector("h6") ||
            link.querySelector('[class*="title"]');

          const descEl =
            link.querySelector("p.sc-dkzDqf.hjVTGd") ||
            link.querySelector('p:not([class*="team"])');

          const title = titleEl?.textContent?.trim();
          const url = link.getAttribute("href");

          if (title && title.length > 2) {
            results.push({
              name: title,
              description: descEl?.textContent?.trim() || "",
              url: url?.startsWith("http") ? url : `https://devfolio.co${url}`,
              tags: [],
              platform: "Devfolio",
            });
          }
        });

        return results;
      });

      await browser.close();

      console.log(`Found ${projects.length} Devfolio projects`);
      return projects.map((p) =>
        this.createComplianceProject(p, "devfolio", project.projectId)
      );
    } catch (error) {
      await browser.close();
      console.error("Devfolio scraping error:", error);
      return [];
    }
  }

  private async scrapeGitHub(
    project: any
  ): Promise<ScrapedComplianceProject[]> {
    console.log("🐙 Scraping GitHub repositories...");

    try {
      const searchTerms = project.name.split(" ").slice(0, 3).join(" ");
      const response = await axios.get(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(
          searchTerms
        )}&sort=stars&order=desc&per_page=20`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "ComplianceAgent/1.0",
          },
        }
      );

      const repositories = response.data.items || [];

      console.log(`Found ${repositories.length} GitHub repositories`);
      return repositories.map((repo: any) =>
        this.createComplianceProject(
          {
            name: repo.name,
            description: repo.description || "",
            url: repo.html_url,
            stars: repo.stargazers_count,
            language: repo.language,
            createdAt: repo.created_at,
            updatedAt: repo.updated_at,
            owner: repo.owner.login,
            platform: "GitHub",
          },
          "github",
          project.projectId
        )
      );
    } catch (error) {
      console.error("GitHub scraping error:", error);
      return [];
    }
  }

  private createComplianceProject(
    data: any,
    source: string,
    originalProjectId: string
  ): ScrapedComplianceProject {
    return {
      complianceId: `${source}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      originalProjectId,
      projectName: data.name,
      description: data.description || "",
      url: data.url || "",
      platform: data.platform || source,
      hackathon: data.hackathon,
      tags: data.tags || [],
      similarity: 0, // Will be calculated by AI later
      status: "pending_review",
      source,
      discoveredAt: new Date().toISOString(),
      metadata: {
        stars: data.stars,
        language: data.language,
        owner: data.owner,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        scrapedAt: new Date().toISOString(),
      },
    };
  }
}
