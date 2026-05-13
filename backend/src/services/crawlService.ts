/**
 * Crawl Service — Fetches live website data using Playwright
 *
 * Responsibilities:
 * - Launch headless browser
 * - Navigate to target URL
 * - Capture rendered HTML, metadata, and page structure
 * - Handle timeouts and error pages
 */

import { chromium, type Page, type Browser } from "playwright";
import { logger } from "../lib/logger.js";

export interface CrawlResult {
  url: string;
  html: string;
  title: string;
  metaDescription: string;
  statusCode: number;
  loadTimeMs: number;
  pages: CrawledPage[];
}

export interface CrawledPage {
  url: string;
  html: string;
  title: string;
  statusCode: number;
}

const MAX_PAGES = parseInt(process.env.MAX_CRAWL_PAGES || "10", 10);
const TIMEOUT = parseInt(process.env.SCAN_TIMEOUT_MS || "120000", 10);

export async function crawlWebsite(websiteUrl: string): Promise<CrawlResult> {
  const startTime = Date.now();
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "AuthorityGapEngine/3.0 (scan-bot)",
    });
    const page = await context.newPage();

    // Navigate to homepage
    const response = await page.goto(websiteUrl, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT,
    });

    const html = await page.content();
    const title = await page.title();
    const metaDescription = await page
      .locator('meta[name="description"]')
      .getAttribute("content")
      .catch(() => "");

    // Discover internal links for additional pages
    const links = await discoverInternalLinks(page, websiteUrl);
    const pagesToCrawl = links.slice(0, MAX_PAGES - 1);

    const pages: CrawledPage[] = [
      { url: websiteUrl, html, title, statusCode: response?.status() ?? 200 },
    ];

    for (const link of pagesToCrawl) {
      try {
        const navPage = await context.newPage();
        const navResp = await navPage.goto(link, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
        pages.push({
          url: link,
          html: await navPage.content(),
          title: await navPage.title(),
          statusCode: navResp?.status() ?? 200,
        });
        await navPage.close();
      } catch (err) {
        logger.warn({ url: link }, "Failed to crawl subpage");
      }
    }

    await browser.close();

    return {
      url: websiteUrl,
      html,
      title,
      metaDescription: metaDescription || "",
      statusCode: response?.status() ?? 200,
      loadTimeMs: Date.now() - startTime,
      pages,
    };
  } catch (err) {
    if (browser) await browser.close();
    throw err;
  }
}

async function discoverInternalLinks(page: Page, baseUrl: string): Promise<string[]> {
  const origin = new URL(baseUrl).origin;
  const links: string[] = await page.evaluate((orig) => {
    return Array.from(document.querySelectorAll("a[href]"))
      .map((a) => (a as HTMLAnchorElement).href)
      .filter((href) => href.startsWith(orig))
      .filter((href, i, arr) => arr.indexOf(href) === i);
  }, origin);

  return links.filter((l) => l !== baseUrl && !l.includes("#"));
}
