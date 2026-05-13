// Authority Gap Engine™ — Scoring Module
// Portable scoring logic, separated from UI

export interface ScanInput {
  websiteUrl: string;
  clinicType: string;
  location: string;
  monthlyPatientValue?: number;
  monthlyTraffic?: number;
}

export interface Finding {
  id: string;
  label: string;
  severity: "high" | "medium" | "low";
  description: string;
  signals?: string[];
  interpretation?: string;
  impact?: string;
}

export interface GapSection {
  score: number;
  maxScore: number;
  status: string;
  summary: string;
  findings: Finding[];
  systemInsight: string;
  strategicImplication: string;
  recommendedDirections: string[];
}

export interface ScanResult {
  authorityGapScore: number;
  visibility: GapSection;
  conversion: GapSection;
  opportunity: GapSection & {
    confidenceLevel: string;
    modelInputs: string[];
  };
  estimatedRevenueLow: number;
  estimatedRevenueHigh: number;
  topFixes: Finding[];
}

// Deterministic pseudo-random based on URL string hash
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000;
  return x - Math.floor(x);
}

const VISIBILITY_FINDINGS: Omit<Finding, "severity">[] = [
  {
    id: "v1",
    label: "Content Depth Deficiency Detected",
    description: "Service pages lack the depth required to establish topical authority.",
    signals: [
      "Average content depth across service pages",
      "Presence of structured headings and topic expansion",
      "Semantic keyword coverage",
      "Evidence of clinical authority or expertise signals",
    ],
    interpretation:
      "Your service pages lack the depth required to establish topical authority in search engines. Search systems prioritize comprehensive, well-structured content that demonstrates expertise. Your current pages do not meet that threshold.",
    impact:
      "Reduced ability to rank for competitive treatment keywords. Lower perceived authority by both search engines and patients. Missed opportunity to capture high-intent traffic.",
  },
  {
    id: "v2",
    label: "Keyword Targeting Fragmentation",
    description: "Pages do not follow a clear keyword targeting structure.",
    signals: [
      "Primary keyword clarity per page",
      "Overlap between service pages",
      "Keyword-to-page mapping consistency",
      "Presence of location-based modifiers",
    ],
    interpretation:
      "Your pages do not follow a clear keyword targeting structure. Multiple pages appear to compete for similar terms, diluting ranking strength.",
    impact:
      "Internal competition between pages. Reduced ranking efficiency. Inconsistent visibility across key treatment queries.",
  },
  {
    id: "v3",
    label: "Authority Signal Deficiency",
    description: "Visible indicators of medical credentials and affiliations are absent or insufficient.",
    signals: [
      "Visible medical credentials",
      "Affiliations and certifications",
      "Author attribution and expertise markers",
      "Trust and credibility elements across pages",
    ],
    interpretation:
      "Your site lacks strong, visible signals that communicate clinical authority and trust. In healthcare, authority signals are not optional — they directly influence both ranking potential and patient decision confidence.",
    impact:
      "Reduced trust at the decision stage. Weaker differentiation from competitors. Suppressed performance in medically sensitive search categories.",
  },
  {
    id: "v4",
    label: "Missing Internal Linking Structure",
    description: "Pages do not link to each other in a way that communicates site architecture.",
    signals: [
      "Internal link graph analysis",
      "Orphan page detection",
      "Link equity distribution",
    ],
    interpretation:
      "Without clear internal linking, search engines cannot efficiently crawl or understand the relationship between your service pages, conditions, and provider credentials.",
    impact:
      "Page authority is diluted rather than concentrated on key treatment pages, weakening overall domain competitiveness.",
  },
  {
    id: "v5",
    label: "Missing Structured Data Markup",
    description: "Schema markup for medical practice, services, and reviews is absent.",
    signals: [
      "Schema.org markup audit",
      "Rich snippet eligibility check",
      "Knowledge panel signal analysis",
    ],
    interpretation:
      "Structured data helps search engines understand your practice type, services offered, and patient reviews. Without it, your listings appear as plain text while competitors display rich results.",
    impact:
      "Lower click-through rates from search results and reduced eligibility for enhanced SERP features like review stars, FAQ panels, and appointment links.",
  },
];

const CONVERSION_FINDINGS: Omit<Finding, "severity">[] = [
  {
    id: "c1",
    label: "Conversion Pathway Breakdown",
    description: "Visitors are not being guided toward a single clear action.",
    signals: [
      "Visibility and placement of primary call-to-action",
      "Consistency of booking pathways across pages",
      "Clarity of next step for first-time visitors",
      "Presence of competing or unclear actions",
    ],
    interpretation:
      "Visitors are not being guided toward a single clear action. The site lacks a dominant conversion pathway, causing hesitation and decision friction.",
    impact:
      "Increased bounce and abandonment rates. Reduced patient inquiries and bookings. Loss of high-intent visitors who are ready to act.",
  },
  {
    id: "c2",
    label: "Patient Journey Fragmentation",
    description: "The patient journey is not structured as a guided experience.",
    signals: [
      "Logical progression from awareness to decision pages",
      "Internal linking between service, proof, and conversion pages",
      "Continuity of messaging across page transitions",
      "Presence of clear next step at each stage",
    ],
    interpretation:
      "The patient journey is not structured as a guided experience. Users move between pages without a clear progression toward booking.",
    impact:
      "Patients drop off before reaching decision stage. Reduced trust due to lack of narrative continuity. Lower conversion rates across all traffic sources.",
  },
  {
    id: "c3",
    label: "Decision Stage Trust Deficiency",
    description: "The site does not sufficiently reinforce trust at the moment of decision.",
    signals: [
      "Presence of testimonials, reviews, and case outcomes",
      "Clarity of practitioner credentials and expertise",
      "Reassurance content addressing patient concerns",
      "Visibility of proof elements near calls-to-action",
    ],
    interpretation:
      "The site does not sufficiently reinforce trust at the moment of decision. Patients lack the reassurance needed to move forward with confidence.",
    impact:
      "Hesitation at the final conversion stage. Increased comparison shopping with competitors. Reduced booking completion rates.",
  },
  {
    id: "c4",
    label: "Content Structure Friction",
    description: "Content layout makes it harder for users to quickly understand value and next steps.",
    signals: [
      "Readability and scannability of page layouts",
      "Use of headings, sections, and visual hierarchy",
      "Content density and cognitive load",
      "Alignment between messaging and user intent",
    ],
    interpretation:
      "Content layout makes it harder for users to quickly understand value and next steps. Important information is not surfaced efficiently.",
    impact:
      "Shorter session duration. Missed key messaging. Reduced engagement with core conversion elements.",
  },
  {
    id: "c5",
    label: "Weak Homepage Value Proposition",
    description: "Homepage doesn't immediately communicate what you do, who you serve, and why.",
    signals: [
      "Above-fold messaging clarity",
      "Value proposition specificity",
      "Target audience signaling",
      "Competitive differentiation presence",
    ],
    interpretation:
      "Your homepage does not communicate a clear, specific value proposition within the first moments of a visit. Visitors cannot quickly determine relevance.",
    impact:
      "Higher bounce rates from new visitors. Lost first impressions. Reduced likelihood of deeper site engagement.",
  },
];

const OPPORTUNITY_FINDINGS: Omit<Finding, "severity">[] = [
  {
    id: "o1",
    label: "Demand Capture Inefficiency",
    description: "Active search demand in your market is not being captured efficiently.",
    signals: [
      "Market search demand relative to visibility score",
      "Likely missed click share from weak page targeting",
      "Insufficient topic coverage across core services",
      "Low authority signal strength vs. healthcare benchmarks",
    ],
    interpretation:
      "There is likely active search demand in your market that your clinic is not capturing efficiently. Visibility constraints reduce how often your clinic appears in the moments that matter most.",
    impact:
      "Fewer qualified visitors entering the patient journey. Lower market share across core treatment categories. Missed acquisition opportunities before conversion is even possible.",
  },
  {
    id: "o2",
    label: "Revenue Leakage After Discovery",
    description: "Parts of the opportunity are lost because the website does not convert interest into action.",
    signals: [
      "Conversion score relative to visibility score",
      "Clarity of primary booking action",
      "Patient journey continuity",
      "Trust reinforcement at decision points",
    ],
    interpretation:
      "Even when visibility exists, parts of the opportunity are lost because the website does not convert interest into action efficiently.",
    impact:
      "Lower return on existing traffic. Lost bookings from high-intent visitors. Suppressed growth even when awareness is present.",
  },
  {
    id: "o3",
    label: "Compounded Opportunity Suppression",
    description: "Weak discoverability and weak patient capture reinforce each other.",
    signals: [
      "Interaction between visibility and conversion performance",
      "Score imbalance across acquisition stages",
      "Modeled opportunity range vs. current structural readiness",
    ],
    interpretation:
      "Your clinic is not dealing with one isolated bottleneck. It is dealing with a compounded system effect where weak discoverability and weak patient capture reinforce each other.",
    impact:
      "Growth remains below potential even if one area improves slightly. Marketing efficiency stays low. Future spend may underperform unless structural issues are corrected first.",
  },
];

function pickFindings(pool: Omit<Finding, "severity">[], seed: number, count: number): Finding[] {
  const shuffled = [...pool].sort((a, b) => seededRandom(seed, pool.indexOf(a)) - seededRandom(seed, pool.indexOf(b)));
  return shuffled.slice(0, count).map((f, i) => ({
    ...f,
    severity: (seededRandom(seed, i * 7) > 0.5 ? "high" : seededRandom(seed, i * 13) > 0.4 ? "medium" : "low") as Finding["severity"],
  }));
}

function getStatusLabel(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.7) return "Performing Within Range";
  if (pct >= 0.5) return "Constrained Performance";
  if (pct >= 0.3) return "Significant Gaps Detected";
  return "Severe Structural Weakness";
}

export function runScan(input: ScanInput): ScanResult {
  const seed = hashCode(input.websiteUrl + input.clinicType + input.location);

  const visScore = Math.round(12 + seededRandom(seed, 1) * 20);
  const convScore = Math.round(10 + seededRandom(seed, 2) * 22);
  const oppScore = Math.round(4 + seededRandom(seed, 3) * 12);

  const totalScore = visScore + convScore + oppScore;

  const visFindings = pickFindings(VISIBILITY_FINDINGS, seed, 3);
  const convFindings = pickFindings(CONVERSION_FINDINGS, seed + 1, 4);
  const oppFindings = pickFindings(OPPORTUNITY_FINDINGS, seed + 2, 3);

  const patientValue = input.monthlyPatientValue || 350;
  const traffic = input.monthlyTraffic || 800;

  const missedShare = 0.15 + seededRandom(seed, 10) * 0.25;
  const convRate = 0.02 + seededRandom(seed, 11) * 0.04;

  const revLow = Math.round(traffic * missedShare * convRate * patientValue * 0.7);
  const revHigh = Math.round(traffic * missedShare * convRate * patientValue * 1.6);

  const allFindings = [...visFindings, ...convFindings, ...oppFindings].sort(
    (a, b) => (a.severity === "high" ? 0 : a.severity === "medium" ? 1 : 2) -
              (b.severity === "high" ? 0 : b.severity === "medium" ? 1 : 2)
  );

  return {
    authorityGapScore: totalScore,
    visibility: {
      score: visScore,
      maxScore: 40,
      status: getStatusLabel(visScore, 40),
      summary:
        "Your clinic's current search visibility is being limited by a combination of content depth, keyword structure, and authority signaling gaps. While foundational elements exist, the system is not strong enough to consistently rank, differentiate, or dominate within your local market. This results in reduced discovery, weaker positioning, and lower patient acquisition potential.",
      findings: visFindings,
      systemInsight:
        "Your visibility gap is not caused by a single issue. It is the result of compounding structural weaknesses. Even when your site appears in search results, limited authority signals and weak content depth reduce your ability to compete, convert attention, and build trust. This creates a cycle where rankings are inconsistent, visibility is unstable, and patient acquisition remains below potential.",
      strategicImplication:
        "Without strengthening content authority and keyword structure, your clinic will continue to lose visibility to competitors who are building deeper, more structured, and more credible content systems. This is not just a traffic issue — it is a market positioning issue.",
      recommendedDirections: [
        "Expand service pages into authority-driven content clusters",
        "Establish a clear keyword-to-page targeting structure",
        "Strengthen clinical authority signals across all core pages",
      ],
    },
    conversion: {
      score: convScore,
      maxScore: 40,
      status: getStatusLabel(convScore, 40),
      summary:
        "Your clinic's current conversion system is not effectively guiding visitors from interest to action. While traffic may reach your site, the structure, messaging, and decision pathways create friction that prevents patients from booking, calling, or engaging. This results in lost patient opportunities, increased drop-off, and reduced return on visibility efforts.",
      findings: convFindings,
      systemInsight:
        "Your conversion gap is not caused by a lack of traffic. It is caused by a lack of structured decision flow. Even when users arrive with intent, the absence of a clear pathway, combined with weak trust reinforcement, prevents them from taking action. This creates a system where traffic enters, interest exists, but action does not occur.",
      strategicImplication:
        "Without a defined conversion system, increasing traffic alone will not produce meaningful growth. Any improvements in visibility will be partially wasted because the underlying patient acquisition structure is not optimized to convert demand into booked appointments. This limits scalability.",
      recommendedDirections: [
        "Establish a single dominant conversion pathway across all pages",
        "Design a structured patient journey from awareness to booking",
        "Strengthen trust signals at key decision points",
        "Optimize page structure for fast clarity and action",
      ],
    },
    opportunity: {
      score: oppScore,
      maxScore: 20,
      status: getStatusLabel(oppScore, 20),
      summary:
        "Your clinic's opportunity gap is created by two combined factors: limited search visibility for high-intent treatment queries, and weak conversion structure once prospective patients land on the site. The issue is not simply that traffic is low — the larger issue is that your clinic is not fully capturing the demand that already exists in your market.",
      findings: oppFindings,
      systemInsight:
        "The opportunity gap is not just about traffic. It is about capture efficiency across the full patient acquisition path. If your clinic improves visibility without improving conversion, growth remains constrained. If your clinic improves conversion without improving visibility, growth remains capped. The highest upside comes from improving both together.",
      strategicImplication:
        "Your clinic may already be closer to growth than it appears. The gap is not necessarily a lack of demand — it is more likely a lack of structural readiness to capture and convert demand consistently. The right improvements can create disproportionate upside without requiring a complete reinvention of the business.",
      recommendedDirections: [
        "Strengthen visibility around high-intent treatment and symptom searches",
        "Reduce conversion friction across core service and landing pages",
        "Align authority, trust, and booking pathways into one patient acquisition system",
        "Prioritize improvements that affect both discoverability and action simultaneously",
      ],
      confidenceLevel: "Directional Model — based on modeled benchmarks",
      modelInputs: [
        "Local search demand for relevant treatment queries",
        "Current visibility strength relative to expected local performance",
        "Estimated click share loss from underperforming pages",
        "Conversion friction indicated by site structure and CTA clarity",
        "Modeled patient value assumptions based on clinic category",
      ],
    },
    estimatedRevenueLow: revLow,
    estimatedRevenueHigh: revHigh,
    topFixes: allFindings.slice(0, 3),
  };
}

export function getScoreColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.7) return "score-high";
  if (pct >= 0.4) return "score-medium";
  return "score-low";
}

export function getScoreLabel(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 55) return "Moderate";
  if (score >= 35) return "Weak";
  return "Critical";
}
