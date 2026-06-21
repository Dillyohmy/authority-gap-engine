import * as cheerio from "cheerio";
import type { CrawledPage } from "./crawlService.js";
import type { CompetitorCrawlSummary } from "../types/competitor.js";

interface CompetitorPageSignals {
  url: string;
  title: string;
  metaDescription: string;
  h1s: string[];
  h2s: string[];
  wordCount: number;
  hasPhoneLink: boolean;
  hasContactForm: boolean;
  hasBookingLink: boolean;
  hasSchema: boolean;
  schemaTypes: string[];
  hasReviewsOrTestimonials: boolean;
  hasProviderBios: boolean;
  hasFaqSection: boolean;
  ctaTexts: string[];
  isServicePage: boolean;
  isLocationPage: boolean;
  isBlogOrResource: boolean;
}

function extractCompetitorPage(page: CrawledPage): CompetitorPageSignals {
  const $ = cheerio.load(page.html);
  const url = page.url.toLowerCase();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const bodyLower = bodyText.toLowerCase();

  // Headings
  const h1s: string[] = [];
  $("h1").each((_, el) => { const t = $(el).text().trim(); if (t) h1s.push(t); });
  const h2s: string[] = [];
  $("h2").each((_, el) => { const t = $(el).text().trim(); if (t) h2s.push(t); });

  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const hasPhoneLink = $('a[href^="tel:"]').length > 0;

  const contactFormKeywords = ["contact", "form", "input", "textarea"];
  const hasContactForm = $("form").length > 0 && contactFormKeywords.some(k => bodyLower.includes(k));

  const bookingKeywords = ["book", "schedule", "appointment", "reserve", "calendar", "calendly", "acuity", "zocdoc"];
  const hasBookingLink =
    $('a[href*="book"], a[href*="schedule"], a[href*="appointment"], a[href*="calendly"], a[href*="acuity"], a[href*="zocdoc"]').length > 0 ||
    bookingKeywords.some(k => bodyLower.includes(k));

  // Schema
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "{}");
      if (data["@type"]) schemaTypes.push(data["@type"]);
    } catch {}
  });
  const hasSchema = schemaTypes.length > 0;

  // Trust signals
  const hasReviewsOrTestimonials =
    bodyLower.includes("testimonial") ||
    bodyLower.includes("review") ||
    bodyLower.includes("patient stories") ||
    bodyLower.includes("google review") ||
    bodyLower.includes("star rating") ||
    $('[class*="review"], [class*="testimonial"], [id*="review"], [id*="testimonial"]').length > 0;

  const hasProviderBios =
    bodyLower.includes("our team") ||
    bodyLower.includes("meet the") ||
    bodyLower.includes("about dr") ||
    bodyLower.includes("provider") ||
    bodyLower.includes("biography") ||
    $('[class*="team"], [class*="doctor"], [class*="provider"], [class*="bio"]').length > 0;

  const hasFaqSection =
    bodyLower.includes("frequently asked") ||
    bodyLower.includes("faq") ||
    $('[class*="faq"], [id*="faq"]').length > 0;

  // CTA texts
  const ctaTexts: string[] = [];
  const ctaSelector = 'a[href*="contact"], a[href*="book"], a[href*="schedule"], a[href*="appointment"], button, .cta, [class*="cta"], [class*="btn"]';
  $(ctaSelector).each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 80 && !ctaTexts.includes(text)) ctaTexts.push(text);
  });

  // Page type classification
  const serviceKeywords = ["service", "treatment", "therapy", "procedure", "care", "specialist", "surgery", "implant", "whitening", "ortho", "chiro", "physio"];
  const locationKeywords = ["location", "near", "serving", "area", "neighborhood", "district", "city", "region"];
  const blogKeywords = ["blog", "article", "news", "resource", "guide", "tip", "advice", "post"];

  const isServicePage = serviceKeywords.some(k => url.includes(k) || h1s.join(" ").toLowerCase().includes(k));
  const isLocationPage = locationKeywords.some(k => url.includes(k) || h1s.join(" ").toLowerCase().includes(k));
  const isBlogOrResource = blogKeywords.some(k => url.includes(k));

  return {
    url: page.url,
    title: $("title").text().trim(),
    metaDescription: $('meta[name="description"]').attr("content")?.trim() || "",
    h1s,
    h2s,
    wordCount,
    hasPhoneLink,
    hasContactForm,
    hasBookingLink,
    hasSchema,
    schemaTypes,
    hasReviewsOrTestimonials,
    hasProviderBios,
    hasFaqSection,
    ctaTexts,
    isServicePage,
    isLocationPage,
    isBlogOrResource,
  };
}

export function extractCompetitorSignals(pages: CrawledPage[]): {
  pages: CompetitorPageSignals[];
  summary: CompetitorCrawlSummary;
} {
  const extracted = pages.map(extractCompetitorPage);
  const allSchemaTypes = [...new Set(extracted.flatMap(p => p.schemaTypes))];
  const allCtas = [...new Set(extracted.flatMap(p => p.ctaTexts))].slice(0, 10);

  // Infer detected services from h1/h2 across pages
  const detectedServices = [
    ...new Set(
      extracted
        .filter(p => p.isServicePage)
        .flatMap(p => [...p.h1s, ...p.h2s.slice(0, 2)])
        .filter(h => h.length < 80)
    )
  ].slice(0, 10);

  // Infer detected locations from location pages
  const detectedLocations = [
    ...new Set(
      extracted
        .filter(p => p.isLocationPage)
        .flatMap(p => p.h1s)
        .filter(h => h.length < 80)
    )
  ].slice(0, 5);

  const avgWordCount = Math.round(
    extracted.reduce((sum, p) => sum + p.wordCount, 0) / Math.max(extracted.length, 1)
  );

  const trustSignals: string[] = [];
  if (extracted.some(p => p.hasReviewsOrTestimonials)) trustSignals.push("Reviews or testimonials");
  if (extracted.some(p => p.hasProviderBios)) trustSignals.push("Provider/team bios");
  if (extracted.some(p => p.hasFaqSection)) trustSignals.push("FAQ section");

  const conversionSignals: string[] = [];
  if (extracted.some(p => p.hasPhoneLink)) conversionSignals.push("Click-to-call phone link");
  if (extracted.some(p => p.hasContactForm)) conversionSignals.push("Contact form");
  if (extracted.some(p => p.hasBookingLink)) conversionSignals.push("Booking/scheduling link");

  const localKeywords = ["near me", "serving", "community", "local", "neighborhood"];
  const localRelevanceSignals: string[] = [];
  for (const p of extracted) {
    const text = [...p.h1s, ...p.h2s, p.title, p.metaDescription].join(" ").toLowerCase();
    for (const kw of localKeywords) {
      if (text.includes(kw) && !localRelevanceSignals.includes(kw)) {
        localRelevanceSignals.push(kw);
      }
    }
  }

  const contentDepth: "shallow" | "moderate" | "deep" =
    avgWordCount > 600 ? "deep" : avgWordCount > 300 ? "moderate" : "shallow";

  const summary: CompetitorCrawlSummary = {
    page_count: extracted.length,
    service_page_count: extracted.filter(p => p.isServicePage).length,
    location_page_count: extracted.filter(p => p.isLocationPage).length,
    blog_or_resource_count: extracted.filter(p => p.isBlogOrResource).length,
    has_clear_phone: extracted.some(p => p.hasPhoneLink),
    has_contact_form: extracted.some(p => p.hasContactForm),
    has_booking_link: extracted.some(p => p.hasBookingLink),
    has_reviews_or_testimonials: extracted.some(p => p.hasReviewsOrTestimonials),
    has_provider_or_team_bios: extracted.some(p => p.hasProviderBios),
    has_schema: extracted.some(p => p.hasSchema),
    schema_types: allSchemaTypes,
    primary_ctas: allCtas,
    detected_services: detectedServices,
    detected_locations: detectedLocations,
    detected_trust_signals: trustSignals,
    detected_faqs: extracted.some(p => p.hasFaqSection),
    estimated_content_depth: contentDepth,
    local_relevance_signals: localRelevanceSignals,
    conversion_signals: conversionSignals,
    avg_word_count: avgWordCount,
    total_ctas: extracted.reduce((sum, p) => sum + p.ctaTexts.length, 0),
  };

  return { pages: extracted, summary };
}
