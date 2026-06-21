import type {
  Competitor,
  CompetitorCrawlSummary,
  CompetitorScores,
  CompetitiveGapAnalysis,
  ComparisonRow,
  CompetitiveGapAction,
} from "../types/competitor.js";
import type { SiteExtraction } from "./extractService.js";

export interface TargetContext {
  siteExtraction: SiteExtraction | null;
  intakeAnswers: Record<string, unknown>;
  websiteUrl: string;
  businessName?: string;
}

export interface CompetitorWithCrawl extends Competitor {
  crawlSummary: CompetitorCrawlSummary | null;
}

// Score 0-100 where higher = stronger
function scoreTarget(extraction: SiteExtraction | null): CompetitorScores {
  if (!extraction) {
    return { service_coverage: 0, local_authority: 0, trust_signals: 0, content_depth: 0, conversion_clarity: 0, schema_coverage: 0, review_strength: 0, ai_visibility: 0, overall: 0 };
  }
  const sw = extraction.sitewide;
  const hp = extraction.homepage;
  const pages = extraction.pages;

  const servicePagesCount = pages.filter(p =>
    p.headings.some(h => /service|treatment|therapy|procedure|care/i.test(h.text))
  ).length;

  const service_coverage = Math.min(100, servicePagesCount * 20);

  const hasLocalSchema = sw.hasLocalSchema ? 40 : 0;
  const hasLocationContent = pages.some(p =>
    p.headings.some(h => /location|near|area|serving/i.test(h.text))
  ) ? 30 : 0;
  const local_authority = Math.min(100, hasLocalSchema + hasLocationContent + (sw.totalPages > 5 ? 30 : 0));

  const trustScore =
    (hp.hasTestimonials ? 25 : 0) +
    (hp.hasReviews ? 25 : 0) +
    (hp.hasProviderBios ? 25 : 0) +
    (hp.hasFaqSection ? 25 : 0);
  const trust_signals = Math.min(100, trustScore);

  const avgWords = sw.avgWordCount;
  const content_depth = avgWords > 800 ? 100 : avgWords > 500 ? 70 : avgWords > 250 ? 45 : 20;

  const ctaScore = Math.min(40, sw.totalCtas * 4);
  const formScore = pages.some(p => p.formCount > 0) ? 30 : 0;
  const phoneScore = hp.hasPhoneLink ? 30 : 0;
  const conversion_clarity = Math.min(100, ctaScore + formScore + phoneScore);

  const schemaTypes = pages.flatMap(p => p.schemaTypes);
  const schema_coverage =
    (schemaTypes.includes("LocalBusiness") || schemaTypes.includes("MedicalBusiness") ? 40 : 0) +
    (schemaTypes.includes("FAQPage") ? 20 : 0) +
    (schemaTypes.includes("Review") || schemaTypes.includes("AggregateRating") ? 25 : 0) +
    (schemaTypes.length > 2 ? 15 : 0);

  // Review strength is manual data only — can't derive from crawl
  const review_strength = 0;

  const ai_visibility =
    (sw.hasFaqSchema ? 30 : 0) +
    (sw.hasMedicalSchema ? 30 : 0) +
    (content_depth > 50 ? 20 : 0) +
    (hp.hasProviderBios ? 20 : 0);

  const overall = Math.round(
    (service_coverage * 0.15 +
    local_authority * 0.15 +
    trust_signals * 0.15 +
    content_depth * 0.15 +
    conversion_clarity * 0.15 +
    schema_coverage * 0.10 +
    review_strength * 0.10 +
    ai_visibility * 0.05)
  );

  return { service_coverage, local_authority, trust_signals, content_depth, conversion_clarity, schema_coverage, review_strength, ai_visibility, overall };
}

function scoreCompetitorFromCrawl(
  summary: CompetitorCrawlSummary | null,
  competitor: Competitor
): CompetitorScores {
  if (!summary) {
    // Manual data only
    const review_strength = competitor.review_count
      ? Math.min(100, Math.round((competitor.review_count / 100) * 60 + (competitor.star_rating ?? 0) * 8))
      : 0;
    return { service_coverage: 0, local_authority: 0, trust_signals: 0, content_depth: 0, conversion_clarity: 0, schema_coverage: 0, review_strength, ai_visibility: 0, overall: review_strength > 0 ? Math.round(review_strength * 0.1) : 0 };
  }

  const service_coverage = Math.min(100, summary.service_page_count * 20);

  const local_authority = Math.min(100,
    (summary.location_page_count > 0 ? 40 : 0) +
    (summary.local_relevance_signals.length > 0 ? 30 : 0) +
    (summary.has_schema && summary.schema_types.some(t => /local|medical|business/i.test(t)) ? 30 : 0)
  );

  const trust_signals = Math.min(100,
    (summary.has_reviews_or_testimonials ? 35 : 0) +
    (summary.has_provider_or_team_bios ? 35 : 0) +
    (summary.detected_faqs ? 30 : 0)
  );

  const content_depth = summary.avg_word_count > 800 ? 100 :
    summary.avg_word_count > 500 ? 70 :
    summary.avg_word_count > 250 ? 45 : 20;

  const conversion_clarity = Math.min(100,
    (summary.has_clear_phone ? 30 : 0) +
    (summary.has_contact_form ? 30 : 0) +
    (summary.has_booking_link ? 40 : 0)
  );

  const schema_coverage = Math.min(100,
    (summary.has_schema ? 40 : 0) +
    (summary.schema_types.includes("FAQPage") ? 20 : 0) +
    (summary.schema_types.some(t => /review|rating/i.test(t)) ? 25 : 0) +
    (summary.schema_types.length > 2 ? 15 : 0)
  );

  const review_strength = competitor.review_count
    ? Math.min(100, Math.round((competitor.review_count / 100) * 60 + (competitor.star_rating ?? 0) * 8))
    : (summary.has_reviews_or_testimonials ? 30 : 0);

  const ai_visibility = Math.min(100,
    (summary.detected_faqs ? 30 : 0) +
    (summary.has_schema ? 30 : 0) +
    (content_depth > 50 ? 20 : 0) +
    (summary.has_provider_or_team_bios ? 20 : 0)
  );

  const overall = Math.round(
    service_coverage * 0.15 +
    local_authority * 0.15 +
    trust_signals * 0.15 +
    content_depth * 0.15 +
    conversion_clarity * 0.15 +
    schema_coverage * 0.10 +
    review_strength * 0.10 +
    ai_visibility * 0.05
  );

  return { service_coverage, local_authority, trust_signals, content_depth, conversion_clarity, schema_coverage, review_strength, ai_visibility, overall };
}

function avgScores(scores: CompetitorScores[]): CompetitorScores {
  if (scores.length === 0) return { service_coverage: 0, local_authority: 0, trust_signals: 0, content_depth: 0, conversion_clarity: 0, schema_coverage: 0, review_strength: 0, ai_visibility: 0, overall: 0 };
  const keys = Object.keys(scores[0]) as (keyof CompetitorScores)[];
  const result = {} as CompetitorScores;
  for (const k of keys) {
    result[k] = Math.round(scores.reduce((s, c) => s + c[k], 0) / scores.length);
  }
  return result;
}

function gapStatus(target: number, competitorAvg: number): ComparisonRow["gap_status"] {
  const diff = target - competitorAvg;
  if (diff >= 15) return "advantage";
  if (diff >= -10) return "competitive";
  if (diff >= -25) return "moderate_gap";
  return "major_gap";
}

function gapLabel(score: number): CompetitiveGapAnalysis["gap_label"] {
  if (score >= 70) return "Strong Advantage";
  if (score >= 50) return "Competitive";
  if (score >= 30) return "Moderate Gap";
  return "Major Gap";
}

function comparisonRow(
  category: string,
  targetVal: string | number,
  competitorAvgVal: string | number,
  strongestVal: string | number,
  targetNum: number,
  competitorAvgNum: number,
  action: string
): ComparisonRow {
  return {
    category,
    target: targetVal,
    competitor_avg: competitorAvgVal,
    strongest_competitor: strongestVal,
    gap_status: gapStatus(targetNum, competitorAvgNum),
    recommended_action: action,
  };
}

function buildPriorityActions(
  targetScores: CompetitorScores,
  competitorAvg: CompetitorScores,
  competitors: CompetitorWithCrawl[]
): CompetitiveGapAction[] {
  const actions: CompetitiveGapAction[] = [];
  const hasCrawledCompetitors = competitors.some(c => c.crawlSummary);

  if (competitorAvg.service_coverage - targetScores.service_coverage > 15) {
    const competitorWithMostServices = competitors
      .filter(c => c.crawlSummary)
      .sort((a, b) => (b.crawlSummary!.service_page_count) - (a.crawlSummary!.service_page_count))[0];
    actions.push({
      title: "Expand service page coverage",
      description: "Competitors have more dedicated service pages. Creating individual pages for each core service improves topical authority and capture for service-specific searches.",
      category: "Service Coverage",
      priority: "high",
      estimated_impact: "High — service pages are direct traffic drivers",
      difficulty: "medium",
      supporting_observation: competitorWithMostServices
        ? `${competitorWithMostServices.business_name} has ${competitorWithMostServices.crawlSummary!.service_page_count} service pages detected`
        : "Competitors outperform on service page count",
    });
  }

  if (competitorAvg.local_authority - targetScores.local_authority > 15) {
    actions.push({
      title: "Build location-specific pages",
      description: "Competitors have stronger local signals. Adding city and neighborhood-specific landing pages helps capture geo-modified searches.",
      category: "Local Authority",
      priority: "high",
      estimated_impact: "High — local pages directly support map pack visibility",
      difficulty: "medium",
      supporting_observation: "Competitors show stronger location page signals and local schema",
    });
  }

  if (competitorAvg.trust_signals - targetScores.trust_signals > 15) {
    actions.push({
      title: "Add testimonials and provider bios",
      description: "Competitors display more patient testimonials and provider credibility signals. Adding these near decision points reduces friction.",
      category: "Trust Signals",
      priority: "high",
      estimated_impact: "High — trust signals directly improve conversion rates",
      difficulty: "easy",
      supporting_observation: hasCrawledCompetitors
        ? `${competitors.filter(c => c.crawlSummary?.has_reviews_or_testimonials).length} of ${competitors.filter(c => c.crawlSummary).length} competitors have visible reviews or testimonials`
        : "Competitors outperform on trust signals",
    });
  }

  if (competitorAvg.conversion_clarity - targetScores.conversion_clarity > 15) {
    const competitorsWithBooking = competitors.filter(c => c.crawlSummary?.has_booking_link);
    actions.push({
      title: "Strengthen conversion paths",
      description: "Competitors offer clearer booking and contact options. Adding persistent CTAs, online booking, and click-to-call improves conversion.",
      category: "Conversion Clarity",
      priority: "critical",
      estimated_impact: "High — directly impacts patient acquisition rate",
      difficulty: "easy",
      supporting_observation: competitorsWithBooking.length > 0
        ? `${competitorsWithBooking.map(c => c.business_name).join(", ")} offer online booking`
        : "Competitors show more conversion-focused design patterns",
    });
  }

  if (competitorAvg.content_depth - targetScores.content_depth > 20) {
    actions.push({
      title: "Increase content depth on key pages",
      description: "Competitor pages have significantly more content. Expanding service, about, and location pages improves both search relevance and patient trust.",
      category: "Content Depth",
      priority: "medium",
      estimated_impact: "Medium — content depth correlates with organic rankings",
      difficulty: "hard",
      supporting_observation: "Competitor average word count exceeds your site's average",
    });
  }

  if (competitorAvg.schema_coverage - targetScores.schema_coverage > 20) {
    actions.push({
      title: "Add structured data markup",
      description: "Competitors use more structured data. Adding LocalBusiness, MedicalBusiness, and FAQPage schema improves rich result eligibility and AI search visibility.",
      category: "Schema Coverage",
      priority: "medium",
      estimated_impact: "Medium — schema improves click-through rate from search",
      difficulty: "medium",
      supporting_observation: "Competitors detected using schema types absent from your site",
    });
  }

  const avgReviews = competitors.reduce((s, c) => s + (c.review_count ?? 0), 0) / Math.max(competitors.length, 1);
  if (avgReviews > 50) {
    actions.push({
      title: "Build a review acquisition system",
      description: "Competitors have significantly more reviews. A systematic post-visit review request increases Google Business Profile authority and conversion trust.",
      category: "Review Strength",
      priority: "high",
      estimated_impact: "High — review count and rating influence map pack ranking",
      difficulty: "easy",
      supporting_observation: `Competitor average review count: ${Math.round(avgReviews)}`,
    });
  }

  return actions.slice(0, 6);
}

export function runCompetitiveComparison(
  targetContext: TargetContext,
  competitors: CompetitorWithCrawl[]
): CompetitiveGapAnalysis {
  const targetScores = scoreTarget(targetContext.siteExtraction);
  const competitorScoresList = competitors.map(c => scoreCompetitorFromCrawl(c.crawlSummary, c));
  const competitorAvgScores = avgScores(competitorScoresList);
  const strongestCompetitorScores = competitorScoresList.reduce(
    (best, c) => c.overall > best.overall ? c : best,
    competitorScoresList[0] ?? { service_coverage: 0, local_authority: 0, trust_signals: 0, content_depth: 0, conversion_clarity: 0, schema_coverage: 0, review_strength: 0, ai_visibility: 0, overall: 0 }
  );

  // Competitive strength score: how well target performs vs competitors
  const strengthScore = competitorAvgScores.overall === 0
    ? targetScores.overall
    : Math.round(Math.min(100, Math.max(0,
        50 + (targetScores.overall - competitorAvgScores.overall)
      )));

  // Gap identification
  const majorGaps: string[] = [];
  const moderateGaps: string[] = [];
  const targetAdvantages: string[] = [];
  const competitorAdvantages: string[] = [];

  const dimensions: { label: string; key: keyof CompetitorScores }[] = [
    { label: "Service page coverage", key: "service_coverage" },
    { label: "Local authority signals", key: "local_authority" },
    { label: "Trust signals", key: "trust_signals" },
    { label: "Content depth", key: "content_depth" },
    { label: "Conversion clarity", key: "conversion_clarity" },
    { label: "Schema coverage", key: "schema_coverage" },
    { label: "Review strength", key: "review_strength" },
    { label: "AI search visibility", key: "ai_visibility" },
  ];

  for (const dim of dimensions) {
    const diff = targetScores[dim.key] - competitorAvgScores[dim.key];
    if (diff <= -25) majorGaps.push(dim.label);
    else if (diff <= -10) moderateGaps.push(dim.label);
    else if (diff >= 15) targetAdvantages.push(dim.label);
    if (diff < 0) competitorAdvantages.push(dim.label);
  }

  const crawledCount = competitors.filter(c => c.crawlSummary).length;
  const dataCompleteness: "full" | "partial" | "minimal" =
    crawledCount === competitors.length ? "full" :
    crawledCount > 0 ? "partial" : "minimal";

  // Build comparison rows
  const avgServicePages = Math.round(competitors.filter(c => c.crawlSummary).reduce((s, c) => s + (c.crawlSummary!.service_page_count), 0) / Math.max(crawledCount, 1));
  const targetServicePages = targetContext.siteExtraction?.pages.filter(p =>
    p.headings.some(h => /service|treatment|therapy|procedure/i.test(h.text))
  ).length ?? 0;
  const strongestCompetitorServicePages = Math.max(...competitors.filter(c => c.crawlSummary).map(c => c.crawlSummary!.service_page_count), 0);

  const avgReviewCount = Math.round(competitors.reduce((s, c) => s + (c.review_count ?? 0), 0) / Math.max(competitors.length, 1));
  const maxReviewCount = Math.max(...competitors.map(c => c.review_count ?? 0), 0);

  const rows: CompetitiveGapAnalysis = {
    overall_competitive_summary: "",  // filled by AI
    competitive_strength_score: strengthScore,
    gap_label: gapLabel(strengthScore),
    target_scores: targetScores,
    competitor_avg_scores: competitorAvgScores,
    strongest_competitor_scores: strongestCompetitorScores,
    major_gaps: majorGaps,
    moderate_gaps: moderateGaps,
    target_advantages: targetAdvantages,
    competitor_advantages: competitorAdvantages,
    service_coverage_comparison: comparisonRow(
      "Service Pages",
      targetServicePages,
      avgServicePages,
      strongestCompetitorServicePages,
      targetScores.service_coverage,
      competitorAvgScores.service_coverage,
      "Create dedicated pages for each core service"
    ),
    local_authority_comparison: comparisonRow(
      "Local Authority",
      `${targetScores.local_authority}/100`,
      `${competitorAvgScores.local_authority}/100`,
      `${strongestCompetitorScores.local_authority}/100`,
      targetScores.local_authority,
      competitorAvgScores.local_authority,
      "Add city-specific landing pages and LocalBusiness schema"
    ),
    trust_signal_comparison: comparisonRow(
      "Trust Signals",
      `${targetScores.trust_signals}/100`,
      `${competitorAvgScores.trust_signals}/100`,
      `${strongestCompetitorScores.trust_signals}/100`,
      targetScores.trust_signals,
      competitorAvgScores.trust_signals,
      "Add testimonials, provider bios, and credentials near CTAs"
    ),
    conversion_comparison: comparisonRow(
      "Conversion Clarity",
      `${targetScores.conversion_clarity}/100`,
      `${competitorAvgScores.conversion_clarity}/100`,
      `${strongestCompetitorScores.conversion_clarity}/100`,
      targetScores.conversion_clarity,
      competitorAvgScores.conversion_clarity,
      "Add online booking, persistent phone CTAs, and contact forms"
    ),
    content_depth_comparison: comparisonRow(
      "Content Depth",
      `${targetContext.siteExtraction?.sitewide.avgWordCount ?? 0} avg words`,
      `${Math.round(competitors.filter(c => c.crawlSummary).reduce((s, c) => s + c.crawlSummary!.avg_word_count, 0) / Math.max(crawledCount, 1))} avg words`,
      `${Math.max(...competitors.filter(c => c.crawlSummary).map(c => c.crawlSummary!.avg_word_count), 0)} avg words`,
      targetScores.content_depth,
      competitorAvgScores.content_depth,
      "Expand service and location page content to 500+ words each"
    ),
    schema_comparison: comparisonRow(
      "Schema Coverage",
      `${targetContext.siteExtraction?.pages.flatMap(p => p.schemaTypes).length ?? 0} types`,
      `${Math.round(competitors.filter(c => c.crawlSummary).reduce((s, c) => s + c.crawlSummary!.schema_types.length, 0) / Math.max(crawledCount, 1))} types`,
      `${Math.max(...competitors.filter(c => c.crawlSummary).map(c => c.crawlSummary!.schema_types.length), 0)} types`,
      targetScores.schema_coverage,
      competitorAvgScores.schema_coverage,
      "Implement LocalBusiness, MedicalBusiness, and FAQPage schema"
    ),
    review_comparison: comparisonRow(
      "Review Strength",
      "Unknown (manual entry needed)",
      `${avgReviewCount} reviews`,
      `${maxReviewCount} reviews`,
      targetScores.review_strength,
      competitorAvgScores.review_strength,
      "Build a systematic post-visit review request process"
    ),
    recommended_priority_actions: buildPriorityActions(targetScores, competitorAvgScores, competitors),
    analyzed_competitors: competitors.length,
    data_completeness: dataCompleteness,
    generated_at: new Date().toISOString(),
  };

  return rows;
}
