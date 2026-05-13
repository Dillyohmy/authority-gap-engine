/**
 * Extract Service — Parses crawled HTML into structured signals
 *
 * Uses Cheerio for fast HTML parsing. Extracts:
 * - Heading hierarchy (H1-H6)
 * - Meta tags (title, description, OG, schema)
 * - CTAs and form elements
 * - Word counts per page
 * - Image alt text coverage
 * - Schema.org structured data
 * - Phone numbers and contact info
 * - Trust signals (testimonials, reviews, credentials)
 */

import * as cheerio from "cheerio";
import type { CrawledPage } from "./crawlService.js";

export interface ExtractedSignals {
  url: string;
  headings: { level: number; text: string }[];
  metaTitle: string;
  metaDescription: string;
  wordCount: number;
  ctaCount: number;
  formCount: number;
  hasSchema: boolean;
  schemaTypes: string[];
  imageCount: number;
  imagesWithAlt: number;
  hasPhoneLink: boolean;
  hasTestimonials: boolean;
  hasReviews: boolean;
  hasProviderBios: boolean;
  hasFaqSection: boolean;
  internalLinks: number;
  externalLinks: number;
}

export interface SiteExtraction {
  homepage: ExtractedSignals;
  pages: ExtractedSignals[];
  sitewide: {
    totalPages: number;
    avgWordCount: number;
    totalCtas: number;
    hasLocalSchema: boolean;
    hasMedicalSchema: boolean;
    hasFaqSchema: boolean;
  };
}

export function extractSignals(pages: CrawledPage[]): SiteExtraction {
  const extracted = pages.map((p) => extractPage(p));
  const homepage = extracted[0]!;

  const avgWordCount =
    extracted.reduce((sum, p) => sum + p.wordCount, 0) / extracted.length;

  const allSchemaTypes = extracted.flatMap((p) => p.schemaTypes);

  return {
    homepage,
    pages: extracted,
    sitewide: {
      totalPages: pages.length,
      avgWordCount: Math.round(avgWordCount),
      totalCtas: extracted.reduce((sum, p) => sum + p.ctaCount, 0),
      hasLocalSchema: allSchemaTypes.some((t) =>
        ["LocalBusiness", "MedicalBusiness", "MedicalOrganization"].includes(t)
      ),
      hasMedicalSchema: allSchemaTypes.some((t) =>
        t.includes("Medical")
      ),
      hasFaqSchema: allSchemaTypes.includes("FAQPage"),
    },
  };
}

function extractPage(page: CrawledPage): ExtractedSignals {
  const $ = cheerio.load(page.html);

  // Headings
  const headings: { level: number; text: string }[] = [];
  for (let level = 1; level <= 6; level++) {
    $(`h${level}`).each((_, el) => {
      headings.push({ level, text: $(el).text().trim() });
    });
  }

  // Meta
  const metaTitle = $("title").text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || "";

  // Word count (body text)
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText.split(" ").filter(Boolean).length;

  // CTAs
  const ctaSelectors = 'a[href*="contact"], a[href*="book"], a[href*="schedule"], a[href*="appointment"], button, .cta, [class*="cta"]';
  const ctaCount = $(ctaSelectors).length;

  // Forms
  const formCount = $("form").length;

  // Schema.org
  const schemaScripts = $('script[type="application/ld+json"]');
  const schemaTypes: string[] = [];
  schemaScripts.each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "{}");
      if (data["@type"]) schemaTypes.push(data["@type"]);
    } catch {}
  });

  // Images
  const images = $("img");
  const imageCount = images.length;
  let imagesWithAlt = 0;
  images.each((_, el) => {
    if ($(el).attr("alt")?.trim()) imagesWithAlt++;
  });

  // Phone
  const hasPhoneLink = $('a[href^="tel:"]').length > 0;

  // Trust signals (heuristic)
  const bodyLower = bodyText.toLowerCase();
  const hasTestimonials =
    bodyLower.includes("testimonial") || bodyLower.includes("patient stories");
  const hasReviews =
    bodyLower.includes("review") || bodyLower.includes("rating");
  const hasProviderBios =
    bodyLower.includes("our team") ||
    bodyLower.includes("meet the doctor") ||
    bodyLower.includes("about dr");
  const hasFaqSection =
    bodyLower.includes("frequently asked") || bodyLower.includes("faq");

  // Links
  const origin = new URL(page.url).origin;
  let internalLinks = 0;
  let externalLinks = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.startsWith(origin) || href.startsWith("/")) internalLinks++;
    else if (href.startsWith("http")) externalLinks++;
  });

  return {
    url: page.url,
    headings,
    metaTitle,
    metaDescription,
    wordCount,
    ctaCount,
    formCount,
    hasSchema: schemaTypes.length > 0,
    schemaTypes,
    imageCount,
    imagesWithAlt,
    hasPhoneLink,
    hasTestimonials,
    hasReviews,
    hasProviderBios,
    hasFaqSection,
    internalLinks,
    externalLinks,
  };
}
