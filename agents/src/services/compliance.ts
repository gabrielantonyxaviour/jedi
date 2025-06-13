import puppeteer from "puppeteer";
import axios from "axios";
import { ComplianceProject } from "../types/compliance";
import { sleep } from "../utils/helper";

export class ComplianceScrapingService {
  async scrapeProjects(
    project: any,
    sources: string[],
    maxResults: number
  ): Promise<ComplianceProject[]> {
    const allProjects: ComplianceProject[] = [];

    console.log(`🔍 Scraping for similar projects to: ${project.name}`);

    for (const source of sources) {
      try {
        let projects: ComplianceProject[] = [];
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

  private async scrapeETHGlobal(project: any): Promise<ComplianceProject[]> {
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

      // Wait for projects to load
      await page.waitForSelector('[data-testid="project-card"]', {
        timeout: 10000,
      });

      // Extract project data
      const projects = await page.evaluate(() => {
        const projectCards = document.querySelectorAll(
          '[data-testid="project-card"]'
        );

        return Array.from(projectCards)
          .slice(0, 30)
          .map((card) => {
            const titleEl = card.querySelector("h3");
            const descEl = card.querySelector("p");
            const hackathonEl = card.querySelector(".text-sm.text-gray-500");
            const linkEl = card.querySelector("a");
            const tagsEls = card.querySelectorAll(".bg-gray-100");

            return {
              name: titleEl?.textContent?.trim() || "",
              description: descEl?.textContent?.trim() || "",
              hackathon: hackathonEl?.textContent?.trim() || "",
              url: linkEl?.getAttribute("href")
                ? `https://ethglobal.com${linkEl.getAttribute("href")}`
                : "",
              tags: Array.from(tagsEls)
                .map((el) => el.textContent?.trim())
                .filter(Boolean),
              platform: "ETHGlobal",
            };
          })
          .filter((p) => p.name);
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

  private async scrapeDoraHacks(project: any): Promise<ComplianceProject[]> {
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

      // Wait for projects to load
      await page.waitForTimeout(3000);

      const projects = await page.evaluate(() => {
        // DoraHacks uses dynamic class names, so we'll look for common patterns
        const projectCards = document.querySelectorAll(
          '[class*="project"], [class*="card"]'
        );
        const results: any[] = [];

        projectCards.forEach((card, index) => {
          if (index >= 30) return;

          const titleEl = card.querySelector('h3, h4, [class*="title"]');
          const descEl = card.querySelector(
            'p, [class*="desc"], [class*="summary"]'
          );
          const tagsEls = card.querySelectorAll(
            '[class*="tag"], [class*="label"]'
          );
          const linkEl = card.querySelector("a");

          const title = titleEl?.textContent?.trim();
          if (title && title.length > 3) {
            results.push({
              name: title,
              description: descEl?.textContent?.trim() || "",
              url: linkEl?.getAttribute("href") || "",
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

  private async scrapeDevfolio(project: any): Promise<ComplianceProject[]> {
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

      // Wait for projects to load
      await page.waitForTimeout(5000);

      const projects = await page.evaluate(() => {
        const projectCards = document.querySelectorAll(
          '[data-testid*="project"], .project-card, [class*="project"]'
        );
        const results: any[] = [];

        projectCards.forEach((card, index) => {
          if (index >= 30) return;

          const titleEl = card.querySelector(
            'h2, h3, h4, [class*="title"], [class*="name"]'
          );
          const descEl = card.querySelector(
            'p, [class*="desc"], [class*="summary"]'
          );
          const hackathonEl = card.querySelector(
            '[class*="hackathon"], [class*="event"]'
          );
          const tagsEls = card.querySelectorAll(
            '[class*="tag"], [class*="skill"], [class*="tech"]'
          );
          const linkEl = card.querySelector("a");

          const title = titleEl?.textContent?.trim();
          if (title && title.length > 3) {
            results.push({
              name: title,
              description: descEl?.textContent?.trim() || "",
              hackathon: hackathonEl?.textContent?.trim() || "",
              url: linkEl?.getAttribute("href") || "",
              tags: Array.from(tagsEls)
                .map((el) => el.textContent?.trim())
                .filter(Boolean),
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

  private async scrapeGitHub(project: any): Promise<ComplianceProject[]> {
    console.log("🐙 Scraping GitHub repositories...");

    try {
      // Search GitHub for similar repositories
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
    projectId: string
  ): ComplianceProject {
    return {
      complianceId: `${source}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      originalProjectId: projectId,
      projectName: data.name,
      description: data.description || "",
      url: data.url || "",
      platform: data.platform || source,
      hackathon: data.hackathon,
      tags: data.tags || [],
      similarity: Math.floor(Math.random() * 40) + 60, // Will be calculated by AI later
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
