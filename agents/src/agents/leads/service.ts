import puppeteer from "puppeteer";
import axios from "axios";
import * as cheerio from "cheerio";
import { Lead } from "../../types/lead";
import { KeywordExtractor } from "../../utils/keyword-extractor";
import { sleep } from "../../utils/helper";

export class LeadScrapingService {
  private keywordExtractor: KeywordExtractor;

  constructor() {
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
          case "all":
          case "yc":
            leads = await this.scrapeYCombinator(project, keywords);
            if (source !== "all") break;

          case "producthunt":
            leads = [
              ...leads,
              ...(await this.scrapeProductHunt(project, keywords)),
            ];
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

      // Increased timeout and better error handling
      await page.goto("https://www.ycombinator.com/companies", {
        waitUntil: "networkidle0",
        timeout: 60000, // Increased to 60 seconds
      });

      // Wait for the search input with increased timeout
      try {
        await page.waitForSelector('._searchBox_i9oky_202 input[type="text"]', {
          timeout: 15000,
        });
      } catch (error) {
        console.log("Search box not found, trying alternative selector...");
        // Try alternative selectors
        await page.waitForSelector('input[type="text"]', {
          timeout: 10000,
        });
      }

      // Search for companies
      const searchTerm = keywords.slice(0, 3).join(" ");
      const searchInput =
        (await page.$('._searchBox_i9oky_202 input[type="text"]')) ||
        (await page.$('input[type="text"]'));

      if (searchInput) {
        await searchInput.click();
        await page.keyboard.down("Control");
        await page.keyboard.press("A");
        await page.keyboard.up("Control");
        await searchInput.type(searchTerm);
        await page.keyboard.press("Enter");
      }

      // Wait for payloads to load
      await page.waitForTimeout(5000);

      // Extract companies with better error handling
      const companies = await page.evaluate(() => {
        const companyCards = document.querySelectorAll(
          "a._company_i9oky_355, a[href*='/companies/']"
        );

        return Array.from(companyCards)
          .slice(0, 20)
          .map((card) => {
            try {
              const nameEl =
                card.querySelector("._coName_i9oky_470") ||
                card.querySelector("h3, h2, [class*='name']");
              const descEl =
                card.querySelector("._coDescription_i9oky_495") ||
                card.querySelector("p, [class*='description']");
              const locationEl =
                card.querySelector("._coLocation_i9oky_486") ||
                card.querySelector("[class*='location']");
              const link = card.getAttribute("href");

              // Extract industry from pills
              const industryPills = card.querySelectorAll(
                ".pill._pill_i9oky_33, .pill, [class*='pill']"
              );
              const industries = Array.from(industryPills)
                .map((pill) => pill.textContent?.trim())
                .filter(
                  (text) =>
                    text &&
                    !text.includes("20") &&
                    !text.includes("Winter") &&
                    !text.includes("Summer")
                );

              return {
                name: nameEl?.textContent?.trim() || "",
                description: descEl?.textContent?.trim() || "",
                location: locationEl?.textContent?.trim() || "",
                industry: industries[0] || "Startup",
                website: link ? `https://www.ycombinator.com${link}` : "",
                batch:
                  Array.from(industryPills)
                    .find((pill) => pill.textContent?.includes("20"))
                    ?.textContent?.trim() || "",
              };
            } catch (error) {
              console.error("Error extracting company data:", error);
              return null;
            }
          })
          .filter((c) => c && c.name);
      });

      await browser.close();

      console.log(`Found ${companies.length} YC companies`);
      return companies.map((company: any) =>
        this.createLead(company, "yc_companies", project.projectId, {
          batch: company.batch,
          ycProfile: company.website,
        })
      );
    } catch (error) {
      await browser.close();
      console.error("YC scraping error:", error);
      // Return empty array instead of throwing
      return [];
    }
  }

  private async scrapeProductHunt(
    project: any,
    keywords: string[]
  ): Promise<Lead[]> {
    console.log("🚀 Scraping Product Hunt...");

    try {
      const searchTerm = keywords.slice(0, 2).join(" ");
      const response = await axios.get(
        `https://www.producthunt.com/search?q=${encodeURIComponent(
          searchTerm
        )}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );

      const $ = cheerio.load(response.data);
      const products: any[] = [];

      $('button[data-test*="spotlight-payload-product"]').each((i, el) => {
        if (i >= 15) return false;

        const $el = $(el);
        const name = $el
          .find(".text-16.font-semibold.text-dark-gray")
          .text()
          .trim();
        const description = $el
          .find(".text-14.font-normal.text-light-gray")
          .first()
          .text()
          .trim();
        const reviews = $el.find(".text-brand-500").text().trim();
        const productId = $el
          .attr("data-test")
          ?.replace("spotlight-payload-product-", "");

        if (name) {
          products.push({
            name: name,
            company: name,
            description: description || `Product Hunt product with ${reviews}`,
            website: productId
              ? `https://www.producthunt.com/products/${productId}`
              : "https://www.producthunt.com",
            industry: "Product/SaaS",
            reviews: reviews || "0 reviews",
            source: "ProductHunt",
          });
        }
      });

      console.log(`Found ${products.length} Product Hunt products`);
      return products.map((product) =>
        this.createLead(product, "product_hunt", project.projectId, {
          reviews: product.reviews,
          source: product.source,
        })
      );
    } catch (error) {
      console.error("Product Hunt scraping error:", error);
      return [];
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

      $(".product-card").each((i, el) => {
        if (i >= 15) return false;

        const $el = $(el);
        const name = $el.find(".product-card__name").text().trim();
        const tagline = $el.find(".product-card__tagline").text().trim();
        const revenue = $el.find(".product-card__revenue-number").text().trim();
        const link = $el.find(".product-card__link").attr("href");

        if (name) {
          products.push({
            name: name,
            company: name,
            description: tagline || `Indie product with ${revenue} revenue`,
            website: link
              ? `https://www.indiehackers.com${link}`
              : "https://www.indiehackers.com",
            industry: "Indie/Bootstrap",
            revenue: revenue || "$0/month",
            source: "IndieHackers",
          });
        }
      });

      console.log(`Found ${products.length} Indie Hackers products`);
      return products.map((product) =>
        this.createLead(product, "indie_hackers", project.projectId, {
          revenue: product.revenue,
          source: product.source,
        })
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
