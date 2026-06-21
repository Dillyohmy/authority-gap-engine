/**
 * Full Authority Gap Report — Five-Phase Scoring Engine
 * All scores 0-100, higher = stronger.
 */

import type {
  ReportContext,
  PhaseAnalysis,
  FullReportScores,
  ReportFinding,
  ReportPriorityAction,
  MissingDataItem,
} from "../types/fullReport.js";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function intake(ctx: ReportContext, key: string): string {
  const v = ctx.intakeAnswers[key];
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  return String(v);
}

function hasIntake(ctx: ReportContext, key: string): boolean {
  const v = intake(ctx, key);
  return v.length > 0;
}

function scanScores(ctx: ReportContext): Record<string, number> {
  const s = ctx.scanReport?.scores as Record<string, number> | undefined;
  return s ?? {};
}

function sitewide(ctx: ReportContext): Record<string, unknown> {
  const r = ctx.scanReport as Record<string, unknown> | null;
  if (!r) return {};
  // report_json has visibility/conversion/opportunity sections
  return (r.sitewide as Record<string, unknown>) ?? {};
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ─── PHASE 1: FOUNDATION ──────────────────────────────────────────────────────

export function scoreFoundation(ctx: ReportContext): PhaseAnalysis {
  const findings: ReportFinding[] = [];
  const missing: string[] = [];
  const fixes: string[] = [];
  let points = 0;
  const max = 100;

  // Business basics (20pts)
  if (hasIntake(ctx, "practice_name") || ctx.project.business_name) {
    points += 10;
  } else {
    missing.push("Practice / business name");
    findings.push({ id: "f1", label: "Business name not confirmed", severity: "high", description: "Practice name was not entered in intake.", source: "intake" });
  }

  if (ctx.project.website_url) {
    points += 10;
    findings.push({ id: "f2", label: "Website URL confirmed", severity: "positive", description: ctx.project.website_url, source: "project" });
  } else {
    missing.push("Website URL");
    findings.push({ id: "f3", label: "No website URL", severity: "critical", description: "No website URL on record.", source: "project" });
  }

  // Crawl / technical signals (30pts)
  const scan = ctx.scanReport;
  if (scan) {
    const vis = scan.visibility as Record<string, unknown> | undefined;
    const visFindings = (vis?.findings as Array<Record<string, string>> | undefined) ?? [];

    const hasSchemaFinding = visFindings.some(f => /schema/i.test(f.label ?? ""));
    if (!hasSchemaFinding) {
      points += 15;
      findings.push({ id: "f4", label: "Basic crawlability confirmed", severity: "positive", description: "Site was crawled successfully.", source: "scan" });
    } else {
      points += 8;
      findings.push({ id: "f5", label: "Schema or technical issues detected", severity: "medium", description: "Site scan identified structural or schema issues.", source: "scan" });
      fixes.push("Address schema and technical SEO issues identified in site scan");
    }

    const scores = scanScores(ctx);
    const visScore = scores.visibility_score ?? 0;
    if (visScore >= 25) { points += 15; }
    else if (visScore >= 15) { points += 8; }
    else {
      points += 3;
      fixes.push("Strengthen on-page SEO fundamentals: titles, meta descriptions, headings");
    }
  } else {
    missing.push("Website scan results");
    findings.push({ id: "f6", label: "No website scan available", severity: "critical", description: "Website has not been scanned. Foundation scoring is limited.", source: "system" });
    fixes.push("Run a website scan to enable foundation analysis");
  }

  // Contact / location clarity (20pts)
  if (hasIntake(ctx, "phone")) { points += 7; }
  else { missing.push("Phone number"); fixes.push("Confirm phone number in intake"); }

  if (hasIntake(ctx, "address") || hasIntake(ctx, "location")) { points += 7; }
  else { missing.push("Business address"); fixes.push("Add primary address to intake"); }

  if (hasIntake(ctx, "office_hours")) { points += 6; }
  else { missing.push("Office hours"); }

  // About / contact page (15pts)
  if (hasIntake(ctx, "about_page_url")) { points += 8; }
  else { missing.push("About page URL"); }

  if (hasIntake(ctx, "contact_page_url")) { points += 7; }
  else { missing.push("Contact page URL"); }

  // Service area (15pts)
  if (hasIntake(ctx, "service_areas") || hasIntake(ctx, "location")) { points += 15; }
  else { missing.push("Service area definition"); fixes.push("Define service areas in intake to improve local relevance scoring"); }

  const score = clamp((points / max) * 100);

  return {
    score,
    summary: score >= 70
      ? "Foundation is solid — basic business information and website signals are in place."
      : score >= 45
      ? "Foundation needs attention — several basic signals are missing or unclear."
      : "Foundation is weak — critical business information is missing.",
    findings,
    missing_data: missing,
    priority_fixes: fixes,
    estimated_impact: "Strong foundation reduces bounce rate and improves crawl signals across all phases.",
    supporting_observations: [
      `Website scan available: ${!!scan}`,
      `Intake answers completed: ${Object.keys(ctx.intakeAnswers).length}`,
    ],
    recommended_next_steps: [
      "Complete all required intake fields",
      "Run or update website scan",
      "Ensure contact page includes phone, address, and hours",
    ],
  };
}

// ─── PHASE 2: LOCAL AUTHORITY ─────────────────────────────────────────────────

export function scoreLocalAuthority(ctx: ReportContext): PhaseAnalysis {
  const findings: ReportFinding[] = [];
  const missing: string[] = [];
  const fixes: string[] = [];
  let points = 0;

  // GBP URL (25pts)
  if (hasIntake(ctx, "gbp_url")) {
    points += 25;
    findings.push({ id: "l1", label: "GBP URL confirmed", severity: "positive", description: intake(ctx, "gbp_url"), source: "intake" });
  } else {
    missing.push("Google Business Profile URL");
    findings.push({ id: "l2", label: "No GBP URL", severity: "high", description: "Google Business Profile URL was not provided.", source: "intake" });
    fixes.push("Add Google Business Profile URL to intake");
  }

  // GBP category (10pts)
  if (hasIntake(ctx, "gbp_primary_category")) {
    points += 10;
  } else {
    missing.push("Primary GBP category");
    fixes.push("Add primary GBP category to strengthen local intent signals");
  }

  // Reviews (20pts)
  const reviewCount = parseInt(intake(ctx, "google_review_count") || "0", 10) || 0;
  const starRating = parseFloat(intake(ctx, "google_star_rating") || "0") || 0;

  if (reviewCount >= 50) { points += 20; }
  else if (reviewCount >= 20) { points += 13; }
  else if (reviewCount >= 5) { points += 7; }
  else { missing.push("Google review count"); fixes.push("Add review count and star rating to intake"); }

  if (reviewCount > 0) {
    findings.push({ id: "l3", label: `${reviewCount} Google reviews · ${starRating} stars`, severity: reviewCount >= 50 ? "positive" : "medium", description: `${reviewCount} reviews at ${starRating} stars provides ${reviewCount >= 50 ? "strong" : "moderate"} local social proof.`, source: "intake" });
  }

  // Competitor map pack data (15pts)
  const compWithMapPack = ctx.competitors.filter(
    (c) => (c.observed_map_pack_rank as number | null) != null
  );
  if (compWithMapPack.length > 0) {
    points += 15;
    findings.push({ id: "l4", label: `Map pack data for ${compWithMapPack.length} competitor(s)`, severity: "positive", description: "Competitor map pack positions documented.", source: "competitors" });
  } else {
    missing.push("Map pack competitor ranks");
    fixes.push("Enter observed map pack ranks for competitors");
  }

  // Location pages from scan (15pts)
  const gapAnalysis = ctx.gapAnalysis;
  if (gapAnalysis) {
    const localScore = (gapAnalysis.target_scores as Record<string, number> | undefined)?.local_authority ?? 0;
    points += Math.round((localScore / 100) * 15);
    if (localScore < 40) {
      findings.push({ id: "l5", label: "Weak local authority signals on website", severity: "high", description: `Local authority score from competitive analysis: ${localScore}/100`, source: "competitive_analysis" });
      fixes.push("Add location-specific landing pages for each service area");
    }
  } else if (ctx.scanReport) {
    const scores = scanScores(ctx);
    const visScore = scores.visibility_score ?? 0;
    points += Math.round((visScore / 40) * 15);
  }

  // Service areas (15pts)
  const serviceAreas = intake(ctx, "service_areas");
  if (serviceAreas.length > 0) {
    points += 15;
    findings.push({ id: "l6", label: "Service areas defined", severity: "positive", description: `Service area(s): ${serviceAreas}`, source: "intake" });
  } else {
    missing.push("Service area list");
    fixes.push("Define all target cities and service radius in intake");
  }

  const score = clamp(points);

  return {
    score,
    summary: score >= 70
      ? "Local authority is strong — GBP, reviews, and location signals are documented."
      : score >= 45
      ? "Local authority needs improvement — key local signals are incomplete."
      : "Local authority is weak — GBP data and local signals are largely missing.",
    findings,
    missing_data: missing,
    priority_fixes: fixes,
    estimated_impact: "Improving local authority directly impacts map pack visibility and local organic rankings.",
    supporting_observations: [
      `Competitors with map pack data: ${compWithMapPack.length}`,
      `Review count: ${reviewCount || "not provided"}`,
      `GBP URL: ${hasIntake(ctx, "gbp_url") ? "provided" : "missing"}`,
    ],
    recommended_next_steps: [
      "Add GBP URL and primary/secondary categories",
      "Document review count and star rating",
      "Create location-specific service pages for each city served",
    ],
  };
}

// ─── PHASE 3: SERVICE AUTHORITY ───────────────────────────────────────────────

export function scoreServiceAuthority(ctx: ReportContext): PhaseAnalysis {
  const findings: ReportFinding[] = [];
  const missing: string[] = [];
  const fixes: string[] = [];
  let points = 0;

  // Primary services (20pts)
  const primaryServices = intake(ctx, "primary_services") || intake(ctx, "services_offered");
  if (primaryServices.length > 0) {
    points += 20;
    findings.push({ id: "s1", label: "Primary services documented", severity: "positive", description: `Services: ${primaryServices.slice(0, 100)}`, source: "intake" });
  } else {
    missing.push("Primary services list");
    findings.push({ id: "s2", label: "No services documented", severity: "high", description: "Primary services were not entered in intake.", source: "intake" });
    fixes.push("Add primary and revenue-priority services to intake");
  }

  // Revenue priority services (10pts)
  const revPriority = intake(ctx, "revenue_priority_services") || intake(ctx, "high_value_services");
  if (revPriority.length > 0) { points += 10; }
  else { missing.push("Revenue priority services"); }

  // GSC data (20pts)
  const gscQueries = ctx.parsedSummaries["gsc_queries"] as Record<string, unknown> | undefined;
  const gscPages = ctx.parsedSummaries["gsc_pages"] as Record<string, unknown> | undefined;
  if (gscQueries || gscPages) {
    points += 20;
    findings.push({ id: "s3", label: "Search Console data available", severity: "positive", description: "GSC query and/or page data is parsed and available.", source: "gsc_upload" });
    const topQueries = (gscQueries?.top_queries as string[] | undefined) ?? [];
    if (topQueries.length > 0) {
      findings.push({ id: "s4", label: `Top search queries identified`, severity: "positive", description: `Top queries: ${topQueries.slice(0, 5).join(", ")}`, source: "gsc_upload" });
    }
    // Check for position 4-20 opportunities
    const lowCtrQueries = (gscQueries?.high_impression_low_ctr as string[] | undefined) ?? [];
    if (lowCtrQueries.length > 0) {
      findings.push({ id: "s5", label: "High-impression / low-CTR queries found", severity: "high", description: `${lowCtrQueries.length} queries with high impressions but low clicks — ranking but not converting.`, source: "gsc_upload" });
      fixes.push("Optimize titles and meta descriptions for high-impression / low-CTR queries");
    }
  } else {
    missing.push("Google Search Console data");
    fixes.push("Upload Google Search Console Queries and Pages CSVs for deeper service analysis");
  }

  // Keyword ranking data (10pts)
  const kwData = ctx.parsedSummaries["keyword_rankings"] as Record<string, unknown> | undefined;
  if (kwData) {
    points += 10;
    findings.push({ id: "s6", label: "Keyword ranking data available", severity: "positive", description: "Keyword position data parsed from upload.", source: "keyword_upload" });
    const top3 = (kwData.top_3 as number | undefined) ?? 0;
    const pos4to10 = (kwData.pos_4_to_10 as number | undefined) ?? 0;
    if (pos4to10 > top3) {
      findings.push({ id: "s7", label: `${pos4to10} keywords in positions 4-10`, severity: "medium", description: "Multiple keywords just outside page-1 top-3. Quick wins available.", source: "keyword_upload" });
      fixes.push(`Prioritize ${pos4to10} keywords ranking 4-10 — small improvements can reach position 1-3`);
    }
  } else {
    missing.push("Keyword ranking data");
  }

  // Service page coverage from scan (20pts)
  const gapAnalysis = ctx.gapAnalysis;
  if (gapAnalysis) {
    const serviceScore = (gapAnalysis.target_scores as Record<string, number> | undefined)?.service_coverage ?? 0;
    points += Math.round((serviceScore / 100) * 20);
    if (serviceScore < 40) {
      findings.push({ id: "s8", label: "Low service page coverage vs competitors", severity: "high", description: `Service coverage score: ${serviceScore}/100 vs competitor average`, source: "competitive_analysis" });
      fixes.push("Create dedicated pages for each primary service");
    }
  } else if (ctx.scanReport) {
    points += 10; // partial credit for having scan
  }

  // FAQ / educational content (10pts)
  const hasFaq = intake(ctx, "has_faq_content") === "yes" ||
    (ctx.scanReport?.visibility as Record<string, unknown> | undefined)?.summary?.toString().includes("FAQ");
  if (hasFaq) { points += 10; }
  else { missing.push("FAQ or educational content"); fixes.push("Add FAQ sections to service pages"); }

  // Competitor service gaps (10pts)
  if (gapAnalysis) {
    const majorGaps = (gapAnalysis.major_gaps as string[] | undefined) ?? [];
    if (majorGaps.some(g => /service/i.test(g))) {
      findings.push({ id: "s9", label: "Service coverage gap vs competitors", severity: "high", description: "Competitive analysis confirms service coverage is weaker than competitors.", source: "competitive_analysis" });
      fixes.push("Map competitor service pages and create pages for uncovered topics");
    } else {
      points += 10;
    }
  }

  const score = clamp(points);

  return {
    score,
    summary: score >= 70
      ? "Service authority is well documented — services, content, and search data support topical relevance."
      : score >= 45
      ? "Service authority has gaps — key services are not fully covered in content or search data."
      : "Service authority is weak — services are undocumented and search performance data is unavailable.",
    findings,
    missing_data: missing,
    priority_fixes: fixes,
    estimated_impact: "Stronger service authority improves rankings for high-intent treatment and procedure searches.",
    supporting_observations: [
      `GSC data available: ${!!(gscQueries || gscPages)}`,
      `Keyword data available: ${!!kwData}`,
      `Primary services documented: ${!!primaryServices}`,
    ],
    recommended_next_steps: [
      "Upload Google Search Console exports (Queries + Pages)",
      "Create or expand service-specific landing pages",
      "Add FAQ sections aligned with top search queries",
    ],
  };
}

// ─── PHASE 4: TRUST & CONVERSION ─────────────────────────────────────────────

export function scoreTrustConversion(ctx: ReportContext): PhaseAnalysis {
  const findings: ReportFinding[] = [];
  const missing: string[] = [];
  const fixes: string[] = [];
  let points = 0;

  // Primary CTA (20pts)
  const primaryCta = intake(ctx, "primary_cta") || intake(ctx, "preferred_cta");
  if (primaryCta.length > 0) {
    points += 15;
    findings.push({ id: "t1", label: `Primary CTA: "${primaryCta}"`, severity: "positive", description: "Primary call-to-action is defined.", source: "intake" });
  } else {
    missing.push("Primary CTA definition");
    findings.push({ id: "t2", label: "No primary CTA defined", severity: "high", description: "Preferred CTA not specified in intake.", source: "intake" });
    fixes.push("Define and implement a clear primary CTA on every page");
  }

  // Booking / contact path (20pts)
  const hasBooking = intake(ctx, "booking_link").length > 0 || intake(ctx, "has_online_booking") === "yes";
  const hasContactForm = intake(ctx, "has_contact_form") === "yes" || intake(ctx, "contact_form_url").length > 0;
  if (hasBooking) { points += 20; findings.push({ id: "t3", label: "Online booking available", severity: "positive", description: "Booking link or system confirmed.", source: "intake" }); }
  else if (hasContactForm) { points += 12; }
  else { missing.push("Booking or contact form"); fixes.push("Add online booking or contact form to reduce friction"); }

  // Trust signals from scan (20pts)
  const gapAnalysis = ctx.gapAnalysis;
  if (gapAnalysis) {
    const trustScore = (gapAnalysis.target_scores as Record<string, number> | undefined)?.trust_signals ?? 0;
    points += Math.round((trustScore / 100) * 20);
    if (trustScore < 40) {
      findings.push({ id: "t4", label: "Weak trust signals vs competitors", severity: "high", description: `Trust signal score: ${trustScore}/100 vs competitor average`, source: "competitive_analysis" });
      fixes.push("Add patient testimonials, provider bios, and credential badges");
    }
  } else if (ctx.scanReport) {
    const convScore = scanScores(ctx).conversion_score ?? 0;
    points += Math.round((convScore / 40) * 20);
  }

  // Provider / team bios (10pts)
  const hasProviderBios = intake(ctx, "has_provider_bios") === "yes" || intake(ctx, "provider_bio_url").length > 0;
  if (hasProviderBios) { points += 10; findings.push({ id: "t5", label: "Provider bios confirmed", severity: "positive", description: "Team or provider biographies are present.", source: "intake" }); }
  else { missing.push("Provider or team bios"); fixes.push("Add provider photos and bios near decision points"); }

  // Testimonials / reviews on site (10pts)
  const hasTestimonials = intake(ctx, "has_testimonials") === "yes";
  if (hasTestimonials) { points += 10; }
  else { missing.push("Patient testimonials on site"); fixes.push("Display Google reviews or patient testimonials on service pages"); }

  // Compliance (10pts)
  const complianceNotes = intake(ctx, "compliance_notes") || intake(ctx, "hipaa_notes");
  if (complianceNotes.length > 0) { points += 10; findings.push({ id: "t6", label: "Compliance notes provided", severity: "positive", description: "Compliance considerations are documented.", source: "intake" }); }
  else { missing.push("Compliance or HIPAA notes"); }

  // GA conversion data (10pts)
  const gaData = ctx.parsedSummaries["ga_traffic"] || ctx.parsedSummaries["ga_landing_pages"] || ctx.parsedSummaries["ga_conversions"];
  if (gaData) {
    points += 10;
    findings.push({ id: "t7", label: "Google Analytics data available", severity: "positive", description: "GA data available for conversion analysis.", source: "ga_upload" });
  } else {
    missing.push("Google Analytics export");
    fixes.push("Upload Google Analytics landing pages or conversions report for UX analysis");
  }

  const score = clamp(points);

  return {
    score,
    summary: score >= 70
      ? "Trust and conversion signals are well established — clear CTAs, proof, and booking paths are documented."
      : score >= 45
      ? "Trust and conversion gaps exist — conversion paths or trust signals need strengthening."
      : "Trust and conversion is weak — critical conversion and credibility elements are missing.",
    findings,
    missing_data: missing,
    priority_fixes: fixes,
    estimated_impact: "Conversion improvements directly increase patient acquisition without requiring more traffic.",
    supporting_observations: [
      `Primary CTA defined: ${!!primaryCta}`,
      `Online booking available: ${hasBooking}`,
      `GA data available: ${!!gaData}`,
    ],
    recommended_next_steps: [
      "Define and implement a primary CTA on every page",
      "Add provider bios and testimonials above the fold",
      "Ensure booking or contact path is mobile-accessible",
    ],
  };
}

// ─── PHASE 5: COMPETITIVE & AI VISIBILITY ─────────────────────────────────────

export function scoreCompetitiveAiVisibility(ctx: ReportContext): PhaseAnalysis {
  const findings: ReportFinding[] = [];
  const missing: string[] = [];
  const fixes: string[] = [];
  let points = 0;

  // Gap analysis (40pts)
  const gapAnalysis = ctx.gapAnalysis;
  if (gapAnalysis) {
    const compStrength = (gapAnalysis.competitive_strength_score as number | undefined) ?? 0;
    points += Math.round((compStrength / 100) * 40);
    const label = gapAnalysis.gap_label as string | undefined;
    findings.push({ id: "c1", label: `Competitive Strength Score: ${compStrength}/100 (${label})`, severity: compStrength >= 60 ? "positive" : compStrength >= 40 ? "medium" : "high", description: gapAnalysis.overall_competitive_summary as string || "Competitive analysis completed.", source: "competitive_analysis" });

    const majorGaps = (gapAnalysis.major_gaps as string[] | undefined) ?? [];
    if (majorGaps.length > 0) {
      findings.push({ id: "c2", label: `${majorGaps.length} major competitive gap(s)`, severity: "high", description: `Major gaps: ${majorGaps.join(", ")}`, source: "competitive_analysis" });
      fixes.push(`Close major gaps: ${majorGaps.slice(0, 2).join(", ")}`);
    }

    const advantages = (gapAnalysis.target_advantages as string[] | undefined) ?? [];
    if (advantages.length > 0) {
      findings.push({ id: "c3", label: `${advantages.length} competitive advantage(s)`, severity: "positive", description: `Advantages: ${advantages.join(", ")}`, source: "competitive_analysis" });
    }
  } else {
    missing.push("Competitive gap analysis");
    findings.push({ id: "c4", label: "No competitive analysis available", severity: "high", description: "Add competitors and run gap analysis for competitive scoring.", source: "system" });
    fixes.push("Add competitors and crawl their websites, then run gap analysis");
  }

  // Competitor coverage (15pts)
  if (ctx.competitors.length >= 3) { points += 15; }
  else if (ctx.competitors.length >= 1) { points += 8; }
  else { missing.push("Competitor information"); }

  // Schema / structured data for AI (20pts)
  const hasSchemaGap = gapAnalysis
    ? ((gapAnalysis.major_gaps as string[] | undefined) ?? []).some(g => /schema/i.test(g))
    : false;

  if (!hasSchemaGap && ctx.scanReport) {
    points += 15;
  } else if (hasSchemaGap) {
    points += 5;
    findings.push({ id: "c5", label: "Schema gap vs competitors", severity: "medium", description: "Competitors have stronger structured data coverage.", source: "competitive_analysis" });
    fixes.push("Implement LocalBusiness, MedicalBusiness, and FAQPage schema");
  }

  // AI readiness from scan (25pts — FAQ, provider bios, entity clarity)
  const hasFaq = intake(ctx, "has_faq_content") === "yes";
  const hasProviderBios = intake(ctx, "has_provider_bios") === "yes";
  const hasEntityInfo = hasIntake(ctx, "practice_name") && hasIntake(ctx, "clinic_type") && hasIntake(ctx, "location");

  if (hasFaq) { points += 8; findings.push({ id: "c6", label: "FAQ content present — AI friendly", severity: "positive", description: "FAQ content is indexed and readable by AI search engines.", source: "intake" }); }
  else { missing.push("FAQ content for AI visibility"); fixes.push("Add FAQ pages — these are the primary source for AI overview answers"); }

  if (hasProviderBios) { points += 8; }
  else { missing.push("Provider entity information"); fixes.push("Add detailed provider bios to establish entity clarity for AI search"); }

  if (hasEntityInfo) { points += 9; }
  else { missing.push("Entity clarity (name, type, location in sync)"); }

  const score = clamp(points);

  return {
    score,
    summary: score >= 70
      ? "Competitive and AI visibility position is strong — clear entity signals and competitive data support AI search readiness."
      : score >= 45
      ? "Competitive visibility needs improvement — gaps in structured data and competitor positioning identified."
      : "Competitive and AI visibility is weak — competitor data, schema, and entity clarity need significant work.",
    findings,
    missing_data: missing,
    priority_fixes: fixes,
    estimated_impact: "AI search visibility (ChatGPT, Gemini, Google AI Overviews) is increasingly driving patient discovery.",
    supporting_observations: [
      `Competitors analyzed: ${ctx.competitors.length}`,
      `Gap analysis available: ${!!gapAnalysis}`,
      `FAQ content: ${hasFaq ? "yes" : "not confirmed"}`,
    ],
    recommended_next_steps: [
      "Add and crawl at least 3 competitors",
      "Run competitive gap analysis",
      "Implement FAQ content and structured data for AI search readiness",
    ],
  };
}

// ─── COMPOSITE SCORES ──────────────────────────────────────────────────────────

export function calculateFullScores(phases: {
  foundation: PhaseAnalysis;
  local_authority: PhaseAnalysis;
  service_authority: PhaseAnalysis;
  trust_conversion: PhaseAnalysis;
  competitive_ai_visibility: PhaseAnalysis;
}): FullReportScores {
  const { foundation, local_authority, service_authority, trust_conversion, competitive_ai_visibility } = phases;

  const authority_score = clamp(
    foundation.score * 0.20 +
    local_authority.score * 0.25 +
    service_authority.score * 0.20 +
    trust_conversion.score * 0.20 +
    competitive_ai_visibility.score * 0.15
  );

  // Audit readiness: how much data is populated
  const audit_readiness_score = clamp(
    (foundation.score > 0 ? 20 : 0) +
    (local_authority.score > 0 ? 20 : 0) +
    (service_authority.score > 0 ? 20 : 0) +
    (trust_conversion.score > 0 ? 20 : 0) +
    (competitive_ai_visibility.score > 0 ? 20 : 0)
  );

  const scan_opportunity = 0; // filled in by report composer from scan

  return {
    authority_score,
    audit_readiness_score,
    foundation_score: foundation.score,
    local_authority_score: local_authority.score,
    service_authority_score: service_authority.score,
    trust_conversion_score: trust_conversion.score,
    competitive_ai_score: competitive_ai_visibility.score,
    opportunity_score: scan_opportunity,
  };
}

// ─── PRIORITY ACTIONS ─────────────────────────────────────────────────────────

export function buildFullReportPriorityActions(
  phases: Record<string, PhaseAnalysis>
): ReportPriorityAction[] {
  const actions: ReportPriorityAction[] = [];

  const phaseOwners: Record<string, string> = {
    foundation: "Web developer",
    local_authority: "SEO specialist",
    service_authority: "Content writer",
    trust_conversion: "Business owner",
    competitive_ai_visibility: "SEO specialist",
  };

  const phaseLabels: Record<string, string> = {
    foundation: "Foundation",
    local_authority: "Local Authority",
    service_authority: "Service Authority",
    trust_conversion: "Trust & Conversion",
    competitive_ai_visibility: "Competitive & AI Visibility",
  };

  for (const [phaseKey, phase] of Object.entries(phases)) {
    const label = phaseLabels[phaseKey] ?? phaseKey;
    const owner = phaseOwners[phaseKey] ?? "Agency team";

    for (const fix of phase.priority_fixes.slice(0, 2)) {
      const isCritical = phase.score < 30;
      const isHigh = phase.score < 50;
      actions.push({
        title: fix,
        description: fix,
        phase: label,
        priority: isCritical ? "critical" : isHigh ? "high" : "medium",
        estimated_impact: phase.estimated_impact,
        difficulty: fix.toLowerCase().includes("upload") || fix.toLowerCase().includes("add") ? "easy" : "moderate",
        why_it_matters: `${label} is currently scored at ${phase.score}/100.`,
        supporting_data: phase.supporting_observations.join("; "),
        recommended_owner: owner,
      });
    }
  }

  // Sort by priority
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return actions.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3)).slice(0, 12);
}

// ─── MISSING DATA MANIFEST ────────────────────────────────────────────────────

export function buildMissingDataManifest(
  phases: Record<string, PhaseAnalysis>
): MissingDataItem[] {
  const items: MissingDataItem[] = [];

  const phaseMap: Record<string, string> = {
    foundation: "Foundation",
    local_authority: "Local Authority",
    service_authority: "Service Authority",
    trust_conversion: "Trust & Conversion",
    competitive_ai_visibility: "Competitive & AI Visibility",
  };

  const importanceMap: Record<string, { why: string; format: string; required_or_optional: "required" | "recommended" | "optional" }> = {
    "Google Business Profile URL": { why: "Critical for local search ranking and map pack analysis", format: "Paste GBP listing URL from Google Maps", required_or_optional: "recommended" },
    "Google Search Console data": { why: "Reveals actual search queries, rankings, and click opportunities", format: "Download CSV from GSC Performance > Search Results", required_or_optional: "recommended" },
    "Google Analytics export": { why: "Identifies which pages convert and where users drop off", format: "Export Landing Pages or Events CSV from GA4", required_or_optional: "recommended" },
    "Keyword ranking data": { why: "Shows current position gaps and quick-win opportunities", format: "Export from Semrush, Ahrefs, or Mangools", required_or_optional: "optional" },
    "Website scan results": { why: "Required for on-page and technical SEO scoring", format: "Run website scan from the Scan page", required_or_optional: "required" },
    "Competitor information": { why: "Required for competitive gap analysis and benchmarking", format: "Add competitors from the Competitors page", required_or_optional: "recommended" },
    "Competitive gap analysis": { why: "Required for Phase 5 scoring", format: "Run gap analysis after crawling competitors", required_or_optional: "recommended" },
  };

  for (const [phaseKey, phase] of Object.entries(phases)) {
    const phaseLabel = phaseMap[phaseKey] ?? phaseKey;
    for (const item of phase.missing_data) {
      const meta = importanceMap[item] ?? {
        why: `Missing ${item} limits ${phaseLabel} accuracy`,
        format: "Complete the relevant intake section",
        required_or_optional: "optional" as const,
      };
      items.push({
        item_name: item,
        phase: phaseLabel,
        why_it_matters: meta.why,
        recommended_input_format: meta.format,
        required_or_optional: meta.required_or_optional,
      });
    }
  }

  return items;
}
