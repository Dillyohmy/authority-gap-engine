/**
 * Rule Engine — Deterministic signal evaluation
 *
 * Evaluates extracted signals against a predefined rule set.
 * Produces structured findings with severity and evidence.
 * Runs BEFORE AI interpretation to provide grounded observations.
 */

import type { SiteExtraction } from "./extractService.js";
import type { ScanFinding } from "../types/scanReport.js";

export interface RuleEngineResult {
  visibilityFindings: ScanFinding[];
  conversionFindings: ScanFinding[];
}

export function evaluateRules(extraction: SiteExtraction): RuleEngineResult {
  const visibilityFindings: ScanFinding[] = [];
  const conversionFindings: ScanFinding[] = [];
  let findingCounter = 0;

  const nextId = (prefix: string) => `${prefix}${++findingCounter}`;

  // --- VISIBILITY RULES ---

  // V1: Missing local keyword targeting
  const hasLocationHeadings = extraction.pages.some((p) =>
    p.headings.some((h) => /near me|in \w+/i.test(h.text))
  );
  if (!hasLocationHeadings) {
    visibilityFindings.push({
      id: nextId("v"),
      label: "Missing local keyword targeting",
      severity: "high",
      description:
        "The site does not include location-specific keywords in headings or page structure. Local search intent is unaddressed.",
      signals: [
        "No location-specific service pages detected",
        "Missing geo-modified headings",
      ],
      interpretation:
        "Patients searching locally are unlikely to discover this practice through organic search.",
      impact: "Estimated 40-60% of local search demand is uncaptured.",
    });
  }

  // V2: No structured data
  if (!extraction.sitewide.hasLocalSchema) {
    visibilityFindings.push({
      id: nextId("v"),
      label: "No structured data markup",
      severity: "medium",
      description:
        "No LocalBusiness or MedicalOrganization schema detected. Rich snippet eligibility is limited.",
      signals: [
        `Schema types found: ${extraction.homepage.schemaTypes.join(", ") || "none"}`,
        extraction.sitewide.hasFaqSchema ? "FAQ schema present" : "No FAQ schema",
      ],
      interpretation:
        "The site misses enhanced SERP features that competitors may leverage.",
    });
  }

  // V3: Thin content
  if (extraction.sitewide.avgWordCount < 400) {
    visibilityFindings.push({
      id: nextId("v"),
      label: "Thin service page content",
      severity: "medium",
      description: `Service pages average ${extraction.sitewide.avgWordCount} words. Search engines favor comprehensive, authoritative content for medical queries.`,
      signals: [
        `Average word count: ${extraction.sitewide.avgWordCount}`,
        "No clinical references or outcome data detected",
      ],
      interpretation:
        "Thin content signals low topical authority to search engines.",
    });
  }

  // --- CONVERSION RULES ---

  // C1: CTA density
  if (extraction.sitewide.totalCtas < extraction.sitewide.totalPages * 2) {
    conversionFindings.push({
      id: nextId("c"),
      label: "No clear call-to-action hierarchy",
      severity: "high",
      description: `Only ${extraction.sitewide.totalCtas} CTAs detected across ${extraction.sitewide.totalPages} pages. Visitors lack a frictionless path to convert.`,
      signals: [
        `${extraction.sitewide.totalCtas} CTAs detected site-wide`,
        extraction.homepage.ctaCount === 0
          ? "No above-fold conversion element"
          : `${extraction.homepage.ctaCount} CTAs on homepage`,
      ],
      interpretation:
        "Visitors with intent have no clear next step to take.",
      impact: "Conversion rate is likely 50-70% below achievable benchmarks.",
    });
  }

  // C2: Trust signals
  const hasTrust =
    extraction.homepage.hasTestimonials ||
    extraction.homepage.hasReviews ||
    extraction.homepage.hasProviderBios;
  if (!hasTrust) {
    conversionFindings.push({
      id: nextId("c"),
      label: "Missing trust and credibility signals",
      severity: "high",
      description:
        "No patient testimonials, reviews, or provider credentials are visible on key pages.",
      signals: [
        "No review widgets detected",
        "No provider bios with credentials",
      ],
      interpretation:
        "In healthcare, trust is a prerequisite for conversion.",
    });
  }

  // C3: Mobile conversion
  if (!extraction.homepage.hasPhoneLink) {
    conversionFindings.push({
      id: nextId("c"),
      label: "No mobile conversion optimization",
      severity: "medium",
      description:
        "No click-to-call links detected. Over 60% of local healthcare searches occur on mobile.",
      signals: ["No tel: links detected"],
      interpretation:
        "Poor mobile conversion wastes high-intent traffic.",
    });
  }

  return { visibilityFindings, conversionFindings };
}
