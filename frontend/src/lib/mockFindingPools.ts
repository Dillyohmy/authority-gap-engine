/**
 * Authority Gap Engine™ — Finding Pools
 *
 * Pools of findings for each scan category. Each mock run
 * selects 2–4 from each pool with slight wording variation.
 */

import type { ScanFinding } from "@/types/scanReport";

type FindingTemplate = (ctx: FindingContext) => ScanFinding;

export interface FindingContext {
  domain: string;
  businessName: string;
  clinicType: string;
  location: string;
  locationShort: string;
  rng: () => number;
  // dynamic values
  wordCount: number;
  formFields: number;
  ctaCount: number;
  trafficLift: number;
  convLift: number;
  clickShare: number;
  searchVol: number;
  additionalInquiries: number;
  visScore: number;
  convScore: number;
}

function randInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ─── VISIBILITY POOL ─────────────────────────────────────

const VISIBILITY_POOL: FindingTemplate[] = [
  (c) => ({
    id: "v-local-kw",
    label: "Missing local keyword targeting",
    severity: "high",
    description: `${c.domain} does not target high-intent local search terms like '${c.clinicType.toLowerCase()} ${c.locationShort}' or related geo-modified queries. These terms carry significant acquisition potential.`,
    signals: ["No location-specific service pages", "Missing geo-modified headings"],
    interpretation: `Potential customers searching in ${c.location} are unlikely to discover ${c.businessName} through organic search.`,
    impact: `Estimated ${c.trafficLift}–${c.trafficLift + 20}% of local search demand is uncaptured.`,
  }),
  (c) => ({
    id: "v-schema",
    label: "No structured data markup",
    severity: c.visScore < 20 ? "high" : "medium",
    description: `${c.domain} ${pick(c.rng, ["lacks", "is missing", "has no"])} JSON-LD schema for LocalBusiness and FAQPage. This limits rich snippet eligibility.`,
    signals: ["No schema detected on homepage", "No FAQ markup"],
    interpretation: `The site misses enhanced SERP features that competitors ${pick(c.rng, ["leverage", "use", "rely on"])} for higher click-through rates.`,
  }),
  (c) => ({
    id: "v-thin-content",
    label: "Thin service page content",
    severity: "medium",
    description: `Service pages on ${c.domain} average ${pick(c.rng, ["under", "approximately", "around"])} ${c.wordCount} words with no supporting evidence or condition-specific information.`,
    signals: [`Average word count: ${c.wordCount}`, "No clinical references or outcome data"],
    interpretation: `Search engines ${pick(c.rng, ["favor", "prioritize", "reward"])} comprehensive, authoritative content for service-related queries.`,
  }),
  (c) => ({
    id: "v-backlinks",
    label: "Weak backlink profile",
    severity: "medium",
    description: `${c.domain} has ${pick(c.rng, ["minimal", "few", "limited"])} referring domains compared to competitors ranking for ${c.clinicType.toLowerCase()} terms in ${c.location}.`,
    signals: [`Estimated referring domains: ${randInt(c.rng, 5, 25)}`, "No high-authority citations"],
    interpretation: `Domain authority is insufficient to compete for ${pick(c.rng, ["competitive", "high-value", "high-intent"])} search terms.`,
  }),
  (c) => ({
    id: "v-meta",
    label: "Missing or duplicate meta descriptions",
    severity: "medium",
    description: `Multiple pages on ${c.domain} ${pick(c.rng, ["share identical", "have duplicate", "use the same"])} meta descriptions or lack them entirely, reducing click-through rates from search results.`,
    signals: [`${randInt(c.rng, 3, 8)} pages with missing meta descriptions`, "Duplicate title tags detected"],
    interpretation: "Unique, compelling meta descriptions are a direct lever for improving organic CTR.",
  }),
  (c) => ({
    id: "v-page-speed",
    label: "Slow page load performance",
    severity: c.visScore < 15 ? "high" : "low",
    description: `${c.domain} ${pick(c.rng, ["loads slowly", "has elevated load times", "shows poor Core Web Vitals"])} which ${pick(c.rng, ["negatively impacts", "reduces", "hurts"])} both rankings and user experience.`,
    signals: [`Estimated LCP: ${(randInt(c.rng, 30, 65) / 10).toFixed(1)}s`, "No image optimization detected"],
    interpretation: "Page speed is a confirmed ranking factor. Slow sites lose both rankings and visitors.",
  }),
  (c) => ({
    id: "v-blog",
    label: "No content marketing presence",
    severity: "low",
    description: `${c.domain} has ${pick(c.rng, ["no blog", "no resource center", "no educational content"])} targeting informational queries that feed the top of the acquisition funnel.`,
    signals: ["No /blog or /resources section detected", `0 indexed content pages beyond ${randInt(c.rng, 3, 8)} service pages`],
    interpretation: `Informational content ${pick(c.rng, ["builds", "establishes", "reinforces"])} topical authority and captures early-stage search intent.`,
  }),
];

// ─── CONVERSION POOL ─────────────────────────────────────

const CONVERSION_POOL: FindingTemplate[] = [
  (c) => ({
    id: "c-cta",
    label: "No clear call-to-action hierarchy",
    severity: "high",
    description: `${c.domain} presents ${c.ctaCount === 0 ? "no prominent CTAs" : `only ${c.ctaCount} CTA(s)`} on service pages, hero sections, or content areas.`,
    signals: [`${c.ctaCount} CTA(s) detected site-wide`, "No above-fold conversion element"],
    interpretation: `Visitors who arrive with intent have no ${pick(c.rng, ["frictionless", "clear", "obvious"])} path to convert.`,
    impact: `Conversion rate is likely ${c.convLift}–${c.convLift + 15}% below achievable benchmarks.`,
  }),
  (c) => ({
    id: "c-trust",
    label: "Missing trust and credibility signals",
    severity: "high",
    description: `No ${pick(c.rng, ["testimonials, reviews, or certifications", "social proof, reviews, or credentials", "trust indicators or third-party validation"])} visible on key landing pages of ${c.domain}.`,
    signals: ["No review widgets", "No team bios with credentials"],
    interpretation: `Trust is a ${pick(c.rng, ["prerequisite", "critical factor", "baseline requirement"])} for conversion. Its absence creates hesitation.`,
  }),
  (c) => ({
    id: "c-mobile",
    label: "No mobile conversion optimization",
    severity: "medium",
    description: `The mobile experience on ${c.domain} lacks ${pick(c.rng, ["click-to-call buttons, sticky CTAs", "tap-friendly CTAs, simplified forms", "mobile-optimized conversion elements"])}.`,
    signals: ["No tel: links detected", `Form requires ${c.formFields}+ fields on mobile`],
    interpretation: `Over 60% of local searches occur on mobile. ${pick(c.rng, ["Poor mobile conversion wastes high-intent traffic.", "Mobile friction directly reduces lead volume.", "Unoptimized mobile forms cause significant drop-off."])}`,
  }),
  (c) => ({
    id: "c-form",
    label: "Excessive form friction",
    severity: c.formFields > 7 ? "high" : "medium",
    description: `The primary contact form on ${c.domain} requires ${c.formFields}+ fields, ${pick(c.rng, ["creating unnecessary friction", "adding conversion barriers", "increasing abandonment risk"])} for potential leads.`,
    signals: [`${c.formFields} form fields detected`, "No multi-step or progressive disclosure"],
    interpretation: `Each additional form field ${pick(c.rng, ["reduces", "decreases", "lowers"])} completion rates by an estimated 5–10%.`,
    impact: `Simplifying to ${Math.max(3, c.formFields - 3)} fields could improve form completion by ${randInt(c.rng, 15, 35)}%.`,
  }),
  (c) => ({
    id: "c-urgency",
    label: "No urgency or scarcity elements",
    severity: "low",
    description: `${c.domain} ${pick(c.rng, ["provides no reason", "offers no incentive", "gives no motivation"])} for visitors to act immediately rather than defer their decision.`,
    signals: ["No limited-time offers", "No appointment availability indicators"],
    interpretation: "Without urgency, a significant portion of interested visitors leave and never return.",
  }),
  (c) => ({
    id: "c-social-proof",
    label: "No quantified social proof",
    severity: "medium",
    description: `${c.domain} does not display ${pick(c.rng, ["patient counts, years of experience, or outcome statistics", "client numbers, success metrics, or case volume", "quantified results or aggregate satisfaction data"])}.`,
    signals: ["No statistics or counters on landing pages", "No case study or outcome data"],
    interpretation: `Quantified proof ${pick(c.rng, ["reduces perceived risk", "increases conversion confidence", "validates the decision to engage"])}.`,
  }),
  (c) => ({
    id: "c-exit",
    label: "No exit-intent or re-engagement mechanism",
    severity: "low",
    description: `${c.domain} has ${pick(c.rng, ["no exit-intent capture", "no re-engagement popups", "no secondary conversion pathway"])} for visitors who don't convert on first visit.`,
    signals: ["No email capture widget", "No chatbot or live chat detected"],
    interpretation: `Most visitors won't convert on their first visit. ${pick(c.rng, ["Capturing contact info enables follow-up.", "A secondary pathway recovers otherwise lost leads.", "Re-engagement mechanisms extend the conversion window."])}`,
  }),
];

// ─── OPPORTUNITY POOL ────────────────────────────────────

const OPPORTUNITY_POOL: FindingTemplate[] = [
  (c) => ({
    id: "o-search-demand",
    label: "Uncaptured local search demand",
    severity: "high",
    description: `Based on estimated search volume for ${c.clinicType.toLowerCase()} in ${c.location}, ${c.domain} is capturing less than ${c.clickShare}% of available organic demand.`,
    signals: [`Estimated monthly search volume: ${c.searchVol.toLocaleString()}`, `Current organic click share: <${c.clickShare}%`],
    interpretation: `Significant volume is flowing to competitors with ${pick(c.rng, ["stronger search presence", "better optimized sites", "more authoritative content"])} in ${c.location}.`,
    impact: `Potential ${c.additionalInquiries}+ additional inquiries per month from organic search alone.`,
  }),
  (c) => ({
    id: "o-competitor-gap",
    label: "Competitor content advantage",
    severity: "high",
    description: `Top-ranking competitors for ${c.clinicType.toLowerCase()} terms in ${c.location} ${pick(c.rng, ["publish 3–5x more content", "have significantly deeper service pages", "maintain active content strategies"])} compared to ${c.domain}.`,
    signals: [`Competitor avg. indexed pages: ${randInt(c.rng, 25, 80)}`, `${c.domain} indexed pages: ${randInt(c.rng, 4, 12)}`],
    interpretation: "Content volume and depth are strongly correlated with organic visibility in this vertical.",
    impact: `Closing the content gap could capture an additional ${randInt(c.rng, 15, 40)}% of available search traffic.`,
  }),
  (c) => ({
    id: "o-paid-savings",
    label: "Organic alternative to paid spend",
    severity: "medium",
    description: `The search terms ${c.domain} is missing organically would cost an estimated $${randInt(c.rng, 3, 12)},000/mo to cover through paid search in ${c.location}.`,
    signals: [`Avg. CPC for ${c.clinicType.toLowerCase()} terms: $${randInt(c.rng, 8, 35)}`, `Estimated monthly clicks available: ${randInt(c.rng, 200, 800)}`],
    interpretation: `Organic rankings for these terms ${pick(c.rng, ["eliminate ongoing ad spend", "reduce dependency on paid channels", "provide sustainable traffic without per-click cost"])}.`,
  }),
  (c) => ({
    id: "o-conversion-uplift",
    label: "Conversion rate improvement potential",
    severity: "high",
    description: `Current conversion infrastructure on ${c.domain} is ${pick(c.rng, ["well below", "significantly under", "far from"])} industry benchmarks. Optimization could ${pick(c.rng, ["double", "substantially increase", "meaningfully improve"])} lead volume from existing traffic.`,
    signals: [`Estimated current conversion rate: ${(randInt(c.rng, 5, 20) / 10).toFixed(1)}%`, `Industry benchmark: ${(randInt(c.rng, 30, 55) / 10).toFixed(1)}%`],
    interpretation: "Conversion improvements compound with traffic gains for multiplicative revenue impact.",
    impact: `Even a ${randInt(c.rng, 1, 3)}x improvement in conversion rate would add $${randInt(c.rng, 4, 15)},000/mo in estimated revenue.`,
  }),
  (c) => ({
    id: "o-referral-risk",
    label: "Over-reliance on referral channels",
    severity: "medium",
    description: `Without organic search presence, ${c.businessName} likely ${pick(c.rng, ["depends heavily on", "over-indexes on", "relies disproportionately on"])} referrals and word-of-mouth for new business.`,
    signals: ["No organic ranking for primary service terms", "Limited digital acquisition channels"],
    interpretation: `Diversifying acquisition channels ${pick(c.rng, ["reduces risk", "stabilizes growth", "provides predictable volume"])} and supports sustainable scaling.`,
  }),
];

// ─── SELECTION HELPER ────────────────────────────────────

/** Shuffle array in place using Fisher-Yates with seeded RNG */
function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function selectFindings(
  pool: FindingTemplate[],
  ctx: FindingContext,
  min = 2,
  max = 4
): ScanFinding[] {
  const count = randInt(ctx.rng, min, Math.min(max, pool.length));
  return shuffle(ctx.rng, pool).slice(0, count).map((fn) => fn(ctx));
}

export { VISIBILITY_POOL, CONVERSION_POOL, OPPORTUNITY_POOL };
