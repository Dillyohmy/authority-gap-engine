/**
 * Authority Gap Engine™ — Mock Scan Data
 *
 * Used only when VITE_API_BASE_URL is not set (preview mode).
 * Provides realistic demo responses matching the backend contract.
 */

import type { ScanReport, ScanJobStatus } from "@/types/scanReport";
import {
  VISIBILITY_POOL,
  CONVERSION_POOL,
  OPPORTUNITY_POOL,
  selectFindings,
  type FindingContext,
} from "./mockFindingPools";

/** Simple seeded PRNG based on URL string */
function seedFromUrl(url: string): () => number {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (Math.imul(31, h) + url.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 0xffffffff;
  };
}

function randInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Extract a readable domain name from a URL */
function deriveDomain(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim() || "example.com";
}

/** Derive a display name from the domain */
function deriveBusinessName(domain: string): string {
  const base = domain.split(".")[0];
  return base
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Simulated status progression timeline (ms after start) */
const STATUS_TIMELINE: { status: ScanJobStatus; delayMs: number }[] = [
  { status: "queued", delayMs: 0 },
  { status: "fetching", delayMs: 2000 },
  { status: "extracting", delayMs: 4000 },
  { status: "analyzing", delayMs: 7000 },
  { status: "scoring", delayMs: 10000 },
  { status: "generating_report", delayMs: 12000 },
  { status: "completed", delayMs: 14000 },
];

interface MockJob {
  startTime: number;
  url: string;
  clinicType?: string;
  location?: string;
}

const mockJobs = new Map<string, MockJob>();

export function mockStartScan(websiteUrl: string, clinicType?: string, location?: string): string {
  const jobId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  mockJobs.set(jobId, { startTime: Date.now(), url: websiteUrl, clinicType, location });
  return jobId;
}

export function mockGetScanStatus(jobId: string): { status: ScanJobStatus; error?: string } {
  const job = mockJobs.get(jobId);
  if (!job) return { status: "failed", error: "Unknown job ID" };

  const elapsed = Date.now() - job.startTime;
  let current: ScanJobStatus = "queued";
  for (const step of STATUS_TIMELINE) {
    if (elapsed >= step.delayMs) current = step.status;
  }
  return { status: current };
}

export function mockGetScanResult(jobId: string, websiteUrl?: string): ScanReport {
  const job = mockJobs.get(jobId);
  const url = websiteUrl || job?.url || "example.com";
  const domain = deriveDomain(url);
  const businessName = deriveBusinessName(domain);
  const rng = seedFromUrl(url);

  const fallbackTypes = ["Healthcare Practice", "Medical Practice", "Health & Wellness", "Clinical Services"];
  const fallbackLocations = ["your service area", "the local market"];

  const clinicType = job?.clinicType?.trim() || pick(rng, fallbackTypes);
  const location = job?.location?.trim() || pick(rng, fallbackLocations);
  const locationShort = location !== "your service area" && location !== "the local market"
    ? location.split(",")[0]
    : "near me";

  const visScore = randInt(rng, 10, 30);
  const convScore = randInt(rng, 10, 30);
  const oppScore = randInt(rng, 5, 15);
  const authScore = randInt(rng, 35, 65);
  const revLow = randInt(rng, 8, 20) * 1000;
  const revHigh = revLow + randInt(rng, 10, 30) * 1000;
  const searchVol = randInt(rng, 1800, 6500);
  const clickShare = randInt(rng, 5, 25);
  const wordCount = randInt(rng, 150, 350);
  const formFields = randInt(rng, 5, 10);
  const ctaCount = randInt(rng, 0, 2);
  const confidence = pick(rng, ["moderate", "high"] as const);
  const additionalInquiries = randInt(rng, 12, 45);
  const trafficLift = randInt(rng, 20, 55);
  const convLift = randInt(rng, 30, 70);

  // Build shared context for finding pools
  const ctx: FindingContext = {
    domain, businessName, clinicType, location, locationShort, rng,
    wordCount, formFields, ctaCount, trafficLift, convLift,
    clickShare, searchVol, additionalInquiries, visScore, convScore,
  };

  // Select 2–4 findings per section from pools
  const visFindings = selectFindings(VISIBILITY_POOL, ctx, 2, 4);
  const convFindings = selectFindings(CONVERSION_POOL, ctx, 2, 4);
  const oppFindings = selectFindings(OPPORTUNITY_POOL, ctx, 2, 3);

  return {
    scan_id: jobId,
    input: { website_url: url, clinic_type: clinicType, location },
    scores: {
      authority_gap_score: authScore,
      visibility_score: visScore,
      conversion_score: convScore,
      opportunity_score: oppScore,
      confidence_level: confidence,
    },
    estimated_revenue_low: revLow,
    estimated_revenue_high: revHigh,
    executive_summary:
      `${domain} presents ${authScore < 45 ? "significant" : "moderate"} authority gaps across search visibility and conversion pathways. The site lacks structured content targeting high-intent keywords relevant to ${clinicType.toLowerCase()} in ${location}, and conversion elements are limited${ctaCount === 0 ? " with no clear calls-to-action" : " to minimal engagement points"}. There is ${authScore < 45 ? "substantial" : "meaningful"} opportunity to capture additional demand through targeted content strategy and conversion optimization.`,
    visibility: {
      summary:
        `Search visibility for ${domain} is constrained by thin content, missing schema markup, and limited local keyword targeting. The site does not rank for primary ${clinicType.toLowerCase()} service-area terms.`,
      findings: visFindings,
      system_insight:
        `Visibility gaps on ${domain} are structural — not cosmetic. Addressing keyword targeting and content depth would materially improve organic acquisition in ${location}.`,
      strategic_implication:
        `Without local search presence, ${businessName} relies disproportionately on referrals and paid channels for new volume.`,
      recommended_directions: [
        `Create location-specific service pages targeting top 5 ${clinicType.toLowerCase()} keywords`,
        "Implement LocalBusiness and organization schema markup",
        "Expand service page content to 800+ words with supporting context",
      ],
    },
    conversion: {
      summary:
        `Conversion infrastructure on ${domain} is minimal. The site relies on ${ctaCount <= 1 ? "a single generic contact form" : "limited engagement points"} with ${convScore < 20 ? "no" : "few"} trust signals or urgency elements.`,
      findings: convFindings,
      system_insight:
        `The conversion gap on ${domain} is the most actionable area. Simple changes to CTA placement, trust signals, and mobile experience could yield measurable improvements within 30 days.`,
      strategic_implication:
        "Traffic gains from visibility improvements will underperform unless conversion infrastructure is strengthened simultaneously.",
      recommended_directions: [
        "Add prominent CTAs to all service pages and hero sections",
        "Display testimonials and team credentials",
        "Implement click-to-call and sticky mobile CTA",
      ],
    },
    opportunity: {
      summary:
        `Revenue opportunity modeling for ${domain} suggests $${(revLow / 1000).toFixed(0)},000–$${(revHigh / 1000).toFixed(0)},000 in additional monthly revenue is achievable through improved search visibility and conversion optimization.`,
      findings: oppFindings,
      model_inputs: [
        `Local search volume: ${searchVol.toLocaleString()}/mo (estimated)`,
        `Current organic click share: <${clickShare}%`,
        `Assumed conversion rate: ${randInt(rng, 2, 6)}–${randInt(rng, 5, 8)}%`,
        `Average customer value: $${randInt(rng, 250, 500)}/mo`,
        `Competitive density: ${pick(rng, ["moderate", "high", "moderate-high"])}`,
      ],
      confidence_level: confidence,
      system_insight:
        `The opportunity range for ${domain} accounts for competitive variance and implementation quality. The lower bound assumes partial execution; the upper bound assumes comprehensive optimization.`,
      strategic_implication:
        "Even conservative implementation of visibility and conversion improvements would likely yield positive ROI within the first quarter.",
      recommended_directions: [
        "Prioritize high-intent keyword targeting for fastest revenue impact",
        "Combine visibility improvements with conversion optimization for compounding returns",
        "Track acquisition source to validate modeled projections",
      ],
    },
    top_fixes: [
      {
        id: "f1",
        label: "Add local keyword-targeted service pages",
        severity: "high",
        description:
          `Create dedicated pages on ${domain} for each primary service targeting location-specific search terms. This is the highest-impact single action for improving acquisition.`,
        impact: `Expected to capture ${trafficLift}–${trafficLift + 15}% more local search traffic within 60-90 days.`,
      },
      {
        id: "f2",
        label: "Implement conversion CTAs and trust signals",
        severity: "high",
        description:
          `Add prominent calls-to-action, testimonials, and credentials to all key landing pages on ${domain}.`,
        impact: `Could improve conversion rate by ${convLift}–${convLift + 15}% based on industry benchmarks.`,
      },
      {
        id: "f3",
        label: "Deploy structured data and technical SEO foundations",
        severity: visScore < 15 ? "high" : "medium",
        description:
          `Add schema markup, optimize meta descriptions, and ensure proper heading hierarchy across all pages on ${domain}.`,
        impact: `Improves search result presentation and click-through rates by ${randInt(rng, 10, 30)}–${randInt(rng, 25, 40)}%.`,
      },
    ],
    methodology:
      `Revenue opportunity ranges are based on live analysis of ${domain}'s site structure, estimated local search demand in ${location}, click-share benchmarks, and assumed conversion rates for ${clinicType.toLowerCase()} practices. These figures represent modeled opportunity ranges and are not audited financial projections. Actual outcomes depend on competitive dynamics, implementation quality, and market conditions.`,
  };
}

/** Whether we're running in mock mode — single source of truth */
export const IS_MOCK_MODE = !import.meta.env.VITE_API_BASE_URL;

if (import.meta.env.DEV) {
  console.info(
    `[Authority Gap Engine] %c${IS_MOCK_MODE ? "Mock Mode" : "Live Backend"}`,
    `font-weight:bold;color:${IS_MOCK_MODE ? "#f59e0b" : "#22c55e"}`,
    IS_MOCK_MODE
      ? "— Using demo data. Set VITE_API_BASE_URL to connect real backend."
      : `— Connected to ${import.meta.env.VITE_API_BASE_URL}`
  );
}
