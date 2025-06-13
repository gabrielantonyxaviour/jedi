import puppeteer from "puppeteer";
import axios from "axios";
import * as cheerio from "cheerio";
import { Octokit } from "@octokit/rest";
import { Lead, ScrapingResult } from "../types/lead";
import { KeywordExtractor } from "../utils/keyword-extractor";
import { sleep } from "../utils/helper";

export class LeadScrapingService {
  private octokit: Octokit;
  private keywordExtractor: KeywordExtractor;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
    this.keywordExtractor = new KeywordExtractor();
  }

  async scrapeLeads(
    project: any,
    sources: string[],
    maxResults: number
  ): Promise<Lead[]> {
    const allLeads: Lead[] = [];
    const keywords = await this.keywordExtractor.extract(project);

    console.log(`📊 Extracted keywords:`, keywords);

    for (const source of sources) {
      try {
        let leads: Lead[] = [];

        switch (source) {
          case "yc":
          case "all":
            leads = await this.scrapeYCombinator(project, keywords);
            if (source !== "all") break;

          case "producthunt":
            leads = [
              ...leads,
              ...(await this.scrapeProductHunt(project, keywords)),
            ];
            if (source !== "all") break;

          case "github":
            leads = [...leads, ...(await this.scrapeGitHub(project, keywords))];
            if (source !== "all") break;

          case "f6s":
            leads = [...leads, ...(await this.scrapeF6S(project, keywords))];
            if (source !== "all") break;

          case "indiehackers":
            leads = [
              ...leads,
              ...(await this.scrapeIndieHackers(project, keywords)),
            ];
            break;
        }

        allLeads.push(...leads);
        console.log(`✅ ${source}: Found ${leads.length} leads`);
      } catch (error) {
        console.error(`❌ ${source} scraping failed:`, error);
      }

      await sleep(2000); // Rate limiting between sources
    }

    return allLeads.slice(0, maxResults);
  }

  private async scrapeYCombinator(
    project: any,
    keywords: string[]
  ): Promise<Lead[]> {
    console.log("🏢 Scraping Y Combinator...");

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );

      await page.goto("https://www.ycombinator.com/companies", {
        waitUntil: "networkidle0",
      });

      // Search by keywords
      const searchTerm = keywords.slice(0, 3).join(" ");
      await page.type('input[name="q"]', searchTerm);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(3000);

      const companies = await page.evaluate(() => {
        const cards = document.querySelectorAll(
          '[data-page="companies"] .space-y-2'
        );
        return Array.from(cards)
          .slice(0, 20)
          .map((card) => {
            const nameEl = card.querySelector("a h3");
            const descEl = card.querySelector("p");
            const link = card.querySelector("a")?.getAttribute("href");

            return {
              name: nameEl?.textContent?.trim() || "",
              description: descEl?.textContent?.trim() || "",
              website: link ? `https://www.ycombinator.com${link}` : "",
              industry: "Startup",
            };
          })
          .filter((c) => c.name);
      });

      await browser.close();

      return companies.map((company) =>
        this.createLead(company, "yc_companies", project.projectId)
      );
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  private async scrapeProductHunt(
    project: any,
    keywords: string[]
  ): Promise<Lead[]> {
    console.log("🚀 Scraping Product Hunt...");

    try {
      const searchTerm = keywords.slice(0, 2).join("+");
      const response = await axios.get(
        `https://www.producthunt.com/search?q=${searchTerm}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );

      const $ = cheerio.load(response.data);
      const products: any[] = [];

      $('[data-test*="product-item"]').each((i, el) => {
        if (i >= 15) return false; // Limit results

        const $el = $(el);
        const name = $el.find("h3, .product-name").first().text().trim();
        const description = $el
          .find(".product-description, p")
          .first()
          .text()
          .trim();
        const makerLink = $el.find('a[href*="/makers/"]').first().attr("href");

        if (name) {
          products.push({
            name,
            description,
            website: `https://www.producthunt.com${makerLink || ""}`,
            industry: "Product/SaaS",
          });
        }
      });

      return products.map((product) =>
        this.createLead(product, "product_hunt", project.projectId)
      );
    } catch (error) {
      console.error("Product Hunt scraping error:", error);
      return [];
    }
  }

  private async scrapeGitHub(
    project: any,
    keywords: string[]
  ): Promise<Lead[]> {
    console.log("👨‍💻 Scraping GitHub...");

    try {
      const searchQuery = `${keywords.join(" ")} language:javascript stars:>50`;

      const { data } = await this.octokit.rest.search.repos({
        q: searchQuery,
        sort: "stars",
        per_page: 20,
      });

      const leads: Lead[] = [];

      for (const repo of data.items.slice(0, 10)) {
        await sleep(500); // Rate limiting

        try {
          const owner = await this.octokit.rest.users.getByUsername({
            username: repo.owner?.login || "",
          });

          leads.push(
            this.createLead(
              {
                name: owner.data.name || repo.owner?.login,
                email: owner.data.email,
                company: owner.data.company,
                website: owner.data.blog || repo.html_url,
                description: `Developer: ${repo.name} - ${repo.description}`,
                industry: "Software Development",
              },
              "github_developers",
              project.projectId,
              {
                githubProfile: owner.data.html_url,
                topRepo: repo.name,
                stars: repo.stargazers_count,
                followers: owner.data.followers,
              }
            )
          );
        } catch (userError) {
          console.log(`Skipped user ${repo.owner?.login}:`, userError);
        }
      }

      return leads;
    } catch (error) {
      console.error("GitHub scraping error:", error);
      return [];
    }
  }

  private async scrapeF6S(project: any, keywords: string[]): Promise<Lead[]> {
    console.log("💼 Scraping F6S...");

    const browser = await puppeteer.launch({ headless: "new" });

    try {
      const page = await browser.newPage();
      await page.goto("https://www.f6s.com/companies", {
        waitUntil: "networkidle0",
      });

      const companies = await page.evaluate(() => {
        const cards = document.querySelectorAll(".company-card, .startup-card");
        return Array.from(cards)
          .slice(0, 15)
          .map((card) => {
            const name = card
              .querySelector(".company-name, .startup-name")
              ?.textContent?.trim();
            const description = card
              .querySelector(".description, .company-description")
              ?.textContent?.trim();
            const location = card
              .querySelector(".location")
              ?.textContent?.trim();
            const link = card.querySelector("a")?.getAttribute("href");

            return {
              name: name || "",
              description: description || "",
              location: location || "",
              website: link?.startsWith("http")
                ? link
                : `https://www.f6s.com${link}`,
              industry: "Startup/Funding",
            };
          })
          .filter((c) => c.name);
      });

      await browser.close();

      return companies.map((company) =>
        this.createLead(company, "f6s_startups", project.projectId)
      );
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  private async scrapeIndieHackers(
    project: any,
    keywords: string[]
  ): Promise<Lead[]> {
    console.log("🚀 Scraping Indie Hackers...");

    try {
      const response = await axios.get(
        "https://www.indiehackers.com/products",
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );

      const $ = cheerio.load(response.data);
      const products: any[] = [];

      $(".product-card, .product-item").each((i, el) => {
        if (i >= 10) return false;

        const $el = $(el);
        const name = $el.find(".product-name, h3").first().text().trim();
        const description = $el
          .find(".product-description, p")
          .first()
          .text()
          .trim();
        const founder = $el.find(".founder-name, .maker").first().text().trim();

        if (name) {
          products.push({
            name: founder || name,
            company: name,
            description,
            website: "https://www.indiehackers.com",
            industry: "Indie/Bootstrap",
          });
        }
      });

      return products.map((product) =>
        this.createLead(product, "indie_hackers", project.projectId)
      );
    } catch (error) {
      console.error("Indie Hackers scraping error:", error);
      return [];
    }
  }

  private createLead(
    data: any,
    source: string,
    projectId: string,
    metadata: any = {}
  ): Lead {
    return {
      leadId: `${source}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      projectId,
      name: data.name || "Unknown",
      email: data.email,
      company: data.company,
      title: data.title,
      website: data.website,
      industry: data.industry,
      location: data.location,
      score: Math.floor(Math.random() * 40) + 60, // Random score 60-100
      status: "new",
      source,
      discoveredAt: new Date().toISOString(),
      matchReason: `Found via ${source} search`,
      metadata: {
        ...metadata,
        description: data.description,
        scrapedAt: new Date().toISOString(),
      },
    };
  }
}
