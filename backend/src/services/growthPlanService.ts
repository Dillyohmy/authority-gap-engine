/**
 * Growth Plan Service — Deterministic action generation
 *
 * Converts a Full Authority Gap Report into prioritized tasks
 * organized by phase, priority, difficulty, and 30/60/90-day windows.
 *
 * AI interpretation runs AFTER this to add narrative summaries.
 * This layer never invents data — it only acts on what exists.
 */

import { v4 as uuid } from "uuid";
import type { FullReport, PhaseAnalysis } from "../types/fullReport.js";
import type {
  GrowthPlanContext,
  GrowthPlanJson,
  GrowthPlanTask,
  PhaseRoadmap,
  ComplianceReviewItem,
  TaskPriority,
  TaskDifficulty,
  TaskImpact,
  DueWindow,
} from "../types/growthPlan.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function task(
  phase: string,
  title: string,
  description: string,
  priority: TaskPriority,
  difficulty: TaskDifficulty,
  impact: TaskImpact,
  owner: string,
  effort: string,
  window: DueWindow,
  criteria: string,
  deps: string[] = [],
  order = 0
): GrowthPlanTask {
  return {
    id: uuid(),
    phase,
    title,
    description,
    priority,
    difficulty,
    estimated_impact: impact,
    suggested_owner: owner,
    estimated_effort: effort,
    due_window: window,
    completion_criteria: criteria,
    dependencies: deps,
    status: "not_started",
    sort_order: order,
  };
}

function phaseScore(report: FullReport, phase: keyof FullReport["five_phase_analysis"]): number {
  return report.five_phase_analysis[phase]?.score ?? 0;
}

function targetScore(current: number): number {
  if (current >= 80) return Math.min(100, current + 10);
  if (current >= 60) return Math.min(100, current + 20);
  if (current >= 40) return current + 25;
  return current + 30;
}

function hasFinding(phase: PhaseAnalysis, keyword: string): boolean {
  return phase.findings?.some(f =>
    (f.label + f.description).toLowerCase().includes(keyword.toLowerCase())
  ) ?? false;
}

// ── Phase 1: Foundation ───────────────────────────────────────────────────────

function buildFoundationTasks(ctx: GrowthPlanContext): GrowthPlanTask[] {
  const tasks: GrowthPlanTask[] = [];
  const phase = ctx.report.five_phase_analysis.foundation;
  const score = phase.score;
  const p = "foundation";

  // Always included if score < 80
  if (score < 80) {
    tasks.push(task(p, "Audit and fix page title tags", "Review all page titles for keyword inclusion, length (50–60 chars), and uniqueness. Update titles that are missing, duplicated, or too generic.", "high", "easy", "high", "SEO specialist / webmaster", "2 to 4 hours", "30_days", "All pages have unique, keyword-relevant titles under 60 characters.", [], 10));
    tasks.push(task(p, "Audit and improve meta descriptions", "Write unique meta descriptions for all key pages (homepage, service pages, contact). Target 120–160 characters. Include primary keyword and a clear CTA phrase.", "high", "easy", "medium", "SEO specialist / copywriter", "2 to 4 hours", "30_days", "All key pages have unique, compelling meta descriptions.", [], 11));
    tasks.push(task(p, "Review and fix H1 heading structure", "Ensure every page has exactly one H1 that includes the primary keyword for that page. Fix pages with missing or multiple H1 tags.", "high", "easy", "high", "Webmaster / developer", "1 hour", "30_days", "Every page has a single, keyword-aligned H1.", [], 12));
  }

  // Schema issues
  if (score < 70 || hasFinding(phase, "schema")) {
    tasks.push(task(p, "Add LocalBusiness and MedicalOrganization schema", "Implement structured data markup using Schema.org LocalBusiness and MedicalOrganization types. Include business name, address, phone, hours, and service types.", "high", "moderate", "high", "Developer / SEO specialist", "1 day", "30_days", "Schema validated in Google Rich Results Test with no critical errors.", [], 20));
  }

  // Sitemap
  if (hasFinding(phase, "sitemap") || score < 60) {
    tasks.push(task(p, "Verify and submit sitemap to Google Search Console", "Confirm sitemap.xml exists and is up to date. Submit to Google Search Console. Ensure all key pages are included and none return errors.", "medium", "easy", "medium", "Webmaster / developer", "30 minutes", "30_days", "Sitemap submitted to Search Console with 0 errors.", [], 30));
  }

  // Contact / clarity
  if (score < 70) {
    tasks.push(task(p, "Add phone number and address above the fold", "Place primary phone number and business address prominently on the homepage header or top section. Ensure it is visible on mobile without scrolling.", "critical", "easy", "high", "Web designer / developer", "1 hour", "30_days", "Phone number and address visible in top 300px on mobile and desktop.", [], 5));
    tasks.push(task(p, "Improve contact page clarity", "Ensure contact page includes: phone number, physical address, office hours, contact form, and Google Maps embed. Make the page easy to find in navigation.", "medium", "easy", "medium", "Web designer / developer", "2 to 4 hours", "30_days", "Contact page includes all 5 elements.", [], 31));
  }

  // About page
  if (score < 65) {
    tasks.push(task(p, "Strengthen About page with credentials and mission", "Update the About page to include: provider names and credentials, years in practice, practice philosophy, photos, and any awards or affiliations.", "medium", "moderate", "medium", "Content writer / practice team", "1 day", "60_days", "About page includes credentials, photos, and practice story.", [], 40));
  }

  // Internal navigation
  if (hasFinding(phase, "navigation") || score < 55) {
    tasks.push(task(p, "Improve site navigation and internal link structure", "Audit internal navigation. Ensure all service pages are reachable within 2 clicks from homepage. Add contextual internal links between related pages.", "medium", "moderate", "medium", "Developer / SEO specialist", "2 to 4 hours", "60_days", "All service pages accessible within 2 clicks. 3+ internal links per service page.", [], 41));
  }

  return tasks;
}

// ── Phase 2: Local Authority ──────────────────────────────────────────────────

function buildLocalAuthorityTasks(ctx: GrowthPlanContext): GrowthPlanTask[] {
  const tasks: GrowthPlanTask[] = [];
  const phase = ctx.report.five_phase_analysis.local_authority;
  const score = phase.score;
  const p = "local_authority";
  const hasGbp = ctx.hasGbp;

  // GBP is always critical if not confirmed
  if (!hasGbp || score < 70) {
    tasks.push(task(p, "Claim and fully optimize Google Business Profile", "Claim ownership of the GBP listing. Complete all fields: business name, category, services, description, hours, photos (min 10), Q&A, and posts. Add all service area cities.", "critical", "moderate", "high", "Practice owner / marketing team", "1 day", "30_days", "GBP is 100% complete per Google's completeness guidelines. Minimum 10 photos uploaded.", [], 1));
  }

  if (score < 75) {
    tasks.push(task(p, "Add service area cities to GBP and website", "List all cities and communities served. Add these to GBP service area settings, website footer, and location-relevant pages.", "high", "easy", "high", "Marketing team / webmaster", "1 hour", "30_days", "Service area cities listed on GBP and visible on website.", [], 10));
    tasks.push(task(p, "Build a review generation process", "Create a systematic process to ask every satisfied patient for a Google review. Use follow-up email, text, or a QR code card at checkout. Goal: 5+ new reviews per month.", "high", "moderate", "high", "Practice owner / front desk team", "2 to 4 hours", "30_days", "Review request process documented and in use. At least 2 new reviews within 30 days.", [], 11));
  }

  // Local pages
  if (score < 65) {
    const serviceArea = ctx.serviceArea || "your primary service area";
    tasks.push(task(p, `Create or improve location-specific service pages`, `Build dedicated pages for primary service + location combinations (e.g., "Knee Surgeon in ${serviceArea}"). Each page should be 600+ words, unique, and include local proof.`, "high", "advanced", "high", "Content writer / SEO specialist", "1 week", "60_days", "At least 3 location-specific pages live with unique content, local keywords, and internal links.", [], 20));
    tasks.push(task(p, "Add local proof and community involvement content", "Add mentions of local landmarks, community events, or partner organizations to service area pages and the about page. Signals geographic relevance to search engines.", "medium", "easy", "medium", "Content writer / practice team", "2 to 4 hours", "60_days", "At least 2 pages reference local community content or geographic context.", [], 30));
  }

  // GBP photos
  if (score < 70) {
    tasks.push(task(p, "Upload professional photos to GBP and website", "Add professional photos of: facility exterior, interior, treatment rooms, staff, equipment, and team. Aim for 20+ photos on GBP. Use alt text on website images.", "medium", "easy", "medium", "Practice team / photographer", "1 day", "30_days", "20+ photos on GBP. Key website pages have professional images with alt text.", [], 12));
  }

  // Local FAQs
  if (score < 60) {
    tasks.push(task(p, "Add location-specific FAQ section to key pages", "Create FAQ sections answering questions like 'Where are you located?', 'Do you serve [city]?', 'What are your hours?', 'Do you accept [insurance]?'", "medium", "easy", "medium", "Content writer / practice team", "2 to 4 hours", "60_days", "FAQ section added to homepage and at least 2 service pages with location-relevant questions.", [], 31));
  }

  return tasks;
}

// ── Phase 3: Service Authority ────────────────────────────────────────────────

function buildServiceAuthorityTasks(ctx: GrowthPlanContext): GrowthPlanTask[] {
  const tasks: GrowthPlanTask[] = [];
  const phase = ctx.report.five_phase_analysis.service_authority;
  const score = phase.score;
  const p = "service_authority";
  const services = ctx.revenueServices.length > 0 ? ctx.revenueServices : ["primary services"];
  const hasGsc = ctx.hasGsc;

  if (score < 80) {
    tasks.push(task(p, "Audit existing service pages for depth and keyword alignment", `Review each service page. Target: 600–1200 words, primary keyword in title/H1/first paragraph, related terms throughout, FAQ section, and a clear CTA. Priority services: ${services.slice(0, 3).join(", ")}.`, "high", "moderate", "high", "SEO specialist / content writer", "1 day", "30_days", "All priority service pages meet 600+ word minimum and include FAQ and CTA.", [], 10));
  }

  if (ctx.revenueServices.length > 0) {
    tasks.push(task(p, `Build content around top revenue services`, `Create or significantly expand pages for: ${ctx.revenueServices.slice(0, 4).join(", ")}. Each page should explain the service, who it helps, what to expect, and why this practice is the best choice.`, "critical", "advanced", "high", "Content writer / SEO specialist", "1 week", "60_days", `Dedicated, high-quality pages exist for all top ${Math.min(ctx.revenueServices.length, 4)} revenue services.`, [], 1));
  }

  if (score < 65) {
    tasks.push(task(p, "Add condition and treatment pages to service cluster", "Build supplementary pages for conditions treated, procedures performed, and methods used. These expand topical authority and capture long-tail search traffic.", "high", "advanced", "high", "Content writer / SEO specialist", "2 to 3 days", "60_days", "At least 5 condition or treatment pages live and internally linked to service pages.", [], 20));
    tasks.push(task(p, "Add FAQ sections to all service pages", "Write 5–8 patient-focused questions and answers for each service page. Focus on what patients actually search: cost, recovery, who is a candidate, what to expect.", "medium", "easy", "medium", "Content writer / practice team", "2 to 4 hours", "30_days", "FAQ section on every service page with minimum 5 questions.", [], 21));
  }

  if (hasGsc && score < 75) {
    tasks.push(task(p, "Use Search Console data to find quick-win keyword opportunities", "In Search Console, filter for queries with 50+ impressions and less than 5% CTR. Add these terms to relevant existing pages or create new pages targeting them.", "high", "moderate", "high", "SEO specialist", "2 to 4 hours", "60_days", "Identified minimum 5 keyword opportunities from Search Console. At least 2 pages updated.", [], 22));
  }

  if (score < 60) {
    tasks.push(task(p, "Add internal links between all service pages", "Create a hub-and-spoke internal link structure. Each service page should link to related services, relevant condition pages, and back to the homepage. No orphan service pages.", "medium", "easy", "medium", "SEO specialist / developer", "2 to 4 hours", "30_days", "Every service page has at least 3 contextual internal links to related pages.", [], 30));
    tasks.push(task(p, "Add plain language summaries for complex services", "Write a 2–3 sentence plain English explanation at the top of each complex service page. Helps both patients and AI search systems understand what you do.", "medium", "easy", "medium", "Content writer", "1 hour", "30_days", "Plain language intro paragraph on every technical service page.", [], 31));
  }

  if (ctx.hasCompetitorAnalysis && score < 70) {
    tasks.push(task(p, "Build content for competitor service gaps", "Based on competitor analysis, identify services competitors prominently feature that you offer but do not promote. Build or improve those pages.", "high", "advanced", "high", "Content writer / SEO specialist", "1 week", "90_days", "At least 3 competitor gap service pages created or improved.", [], 40));
  }

  return tasks;
}

// ── Phase 4: Trust & Conversion ───────────────────────────────────────────────

function buildTrustConversionTasks(ctx: GrowthPlanContext): GrowthPlanTask[] {
  const tasks: GrowthPlanTask[] = [];
  const phase = ctx.report.five_phase_analysis.trust_conversion;
  const score = phase.score;
  const p = "trust_conversion";
  const cta = ctx.preferredCta || "Call to schedule";

  if (score < 80) {
    tasks.push(task(p, `Set "${cta}" as the primary CTA across all pages`, `Replace inconsistent CTAs with a single clear primary action: "${cta}". Make it visible in the header, hero section, and at the bottom of every service page. Use a contrasting button color.`, "critical", "easy", "high", "Web designer / developer", "2 to 4 hours", "30_days", `"${cta}" CTA is present above the fold on homepage and on every service page.`, [], 1));
    tasks.push(task(p, "Make phone number click-to-call and always visible", "Ensure the phone number is in the header, sticky on mobile, and formatted as a tel: link so mobile users can tap to call. Remove friction from the call path.", "critical", "easy", "high", "Developer / web designer", "1 hour", "30_days", "Phone number appears in header and as sticky element on mobile. Click-to-call confirmed working.", [], 2));
  }

  if (score < 75) {
    tasks.push(task(p, "Add patient testimonials to key pages", "Add 3–5 patient testimonials to homepage, each primary service page, and contact page. Include patient name (or initials for privacy), condition treated, and outcome.", "high", "moderate", "high", "Practice team / marketing", "2 to 4 hours", "30_days", "Testimonials visible on homepage and at least 3 service pages.", [], 10));
    tasks.push(task(p, "Add provider credentials and bios", "Create or improve provider/team bios with: photo, credentials, specialties, education, and a personal statement. Place bios on About page and link from service pages.", "high", "moderate", "high", "Content writer / practice team", "1 day", "30_days", "All providers have bios with photo and credentials. Bios linked from service pages.", [], 11));
  }

  if (score < 70) {
    tasks.push(task(p, "Improve mobile conversion experience", "Audit the site on mobile. Ensure: phone CTA is sticky, forms are easy to complete on mobile, text is readable without zooming, and key pages load under 3 seconds.", "high", "moderate", "high", "Developer / UX designer", "1 day", "30_days", "Mobile PageSpeed score above 60. Sticky CTA on mobile. Forms complete without horizontal scroll.", [], 12));
    tasks.push(task(p, "Add trust signals above the fold on homepage", "Place visible trust indicators in the hero section or directly below it: years in practice, number of patients served, key credentials, awards, or associations.", "high", "easy", "high", "Web designer / content writer", "2 to 4 hours", "30_days", "At least 3 trust signals visible without scrolling on desktop and mobile homepage.", [], 13));
  }

  if (score < 65) {
    tasks.push(task(p, "Simplify and improve the contact / appointment form", "Reduce contact form to minimum required fields. Add confirmation message after submission. Test form on mobile. Consider adding an online scheduling option.", "high", "moderate", "medium", "Developer / web designer", "2 to 4 hours", "30_days", "Contact form loads fast, has 5 or fewer fields, and shows confirmation after submission.", [], 14));
    tasks.push(task(p, "Clarify insurance plans accepted", "Add a clearly visible list of accepted insurance plans to the website — on the homepage, contact page, and relevant service pages. Update it at least quarterly.", "medium", "easy", "medium", "Practice team / web manager", "1 hour", "30_days", "Insurance list published and visible on at least 2 pages.", [], 20));
    tasks.push(task(p, "Add before/after results or case examples", "If clinically appropriate and legally reviewed, add before/after examples, outcomes data, or success stories to key service pages. These significantly improve conversion.", "medium", "moderate", "high", "Practice team / marketing / compliance review", "2 to 3 days", "60_days", "At least 3 case examples or outcome summaries live. Reviewed for compliance before publication.", [], 30));
  }

  return tasks;
}

// ── Phase 5: Competitive & AI Visibility ──────────────────────────────────────

function buildCompetitiveAiTasks(ctx: GrowthPlanContext): GrowthPlanTask[] {
  const tasks: GrowthPlanTask[] = [];
  const phase = ctx.report.five_phase_analysis.competitive_ai_visibility;
  const score = phase.score;
  const p = "competitive_ai_visibility";

  if (!ctx.hasCompetitorAnalysis) {
    tasks.push(task(p, "Add competitor URLs and run competitive analysis", "Add at least 3 direct competitors to your project and run a competitive gap analysis. This unlocks targeted content recommendations and gap-closing opportunities.", "high", "easy", "high", "Marketing team / practice owner", "30 minutes", "30_days", "3+ competitors added. Competitive analysis completed.", [], 1));
  }

  if (score < 75) {
    tasks.push(task(p, "Improve schema markup quality and coverage", "Expand schema to cover: MedicalOrganization, Physician, MedicalClinic, FAQPage, and Review types. Validate all schema with Google's Rich Results Test. Fix any errors.", "high", "moderate", "high", "Developer / SEO specialist", "1 day", "60_days", "Schema validation passes with 0 errors. At least 4 schema types implemented.", [], 10));
    tasks.push(task(p, "Write an AI-readable business summary", "Create a concise, fact-based 150–200 word description of the practice that clearly states: what you do, who you serve, where you operate, what makes you different, and key credentials. Place in schema markup and on the About page.", "high", "easy", "high", "Content writer / practice owner", "1 hour", "30_days", "Business summary in schema markup. Summary on About page. Clearly answers who/what/where/why.", [], 11));
  }

  if (score < 65) {
    tasks.push(task(p, "Add AI-readable service attribute summaries", "For each primary service, write a 50–100 word plain-language summary that answers: what it is, who it helps, what the process involves, and expected outcomes. These help AI systems like ChatGPT and Google AI Overviews understand and recommend your services.", "high", "moderate", "high", "Content writer", "2 to 4 hours", "60_days", "AI-ready summary written for each primary service. Added to service pages and schema.", [], 20));
    tasks.push(task(p, "Build direct-answer content for common questions", "Create content that directly answers the top 10 questions patients ask about your services. Format as FAQ or Q&A blocks. Use concise, factual answers that AI systems can cite.", "medium", "moderate", "medium", "Content writer / practice team", "2 to 3 days", "90_days", "10+ direct-answer Q&A blocks live across key pages.", [], 30));
  }

  if (score < 55) {
    tasks.push(task(p, "Improve entity clarity across the website", "Ensure the business name, address, phone number, and primary service keywords appear consistently across all pages, schema, and GBP. Entity clarity helps AI systems associate the business with relevant searches.", "medium", "easy", "medium", "SEO specialist / developer", "2 to 4 hours", "60_days", "NAP (name, address, phone) consistent across all pages, schema, and GBP. No conflicting information.", [], 40));
    tasks.push(task(p, "Build content that targets AI search overviews", "Write comprehensive, well-structured content about your primary services that covers: definitions, conditions treated, procedure steps, recovery, costs, and candidacy. AI search systems prefer complete, authoritative content.", "medium", "advanced", "high", "Content writer / SEO specialist", "1 week", "90_days", "At least 2 comprehensive service guides published (1000+ words). Structured with headers and lists.", [], 41));
  }

  return tasks;
}

// ── Quick wins ────────────────────────────────────────────────────────────────

function buildQuickWins(ctx: GrowthPlanContext, allTasks: GrowthPlanTask[]): GrowthPlanTask[] {
  // Quick wins = easy difficulty + 30-day window from all phases
  const wins = allTasks.filter(t => t.difficulty === "easy" && t.due_window === "30_days");

  // Add context-driven quick wins not already captured
  const extras: GrowthPlanTask[] = [];
  if (!ctx.hasGbp) {
    extras.push(task("local_authority", "Add Google Business Profile URL to intake", "Submit your GBP URL in the intake form so the system can use it for deeper local analysis.", "high", "easy", "medium", "Practice owner", "15 minutes", "30_days", "GBP URL added to project intake.", [], 0));
  }
  if (!ctx.revenueServices.length) {
    extras.push(task("service_authority", "Add revenue priority services to intake", "List your top 3–5 revenue-generating services in the intake form. This unlocks revenue-aligned recommendations.", "high", "easy", "high", "Practice owner", "15 minutes", "30_days", "Revenue services added to project intake.", [], 0));
  }

  return [...extras, ...wins].slice(0, 10);
}

// ── High impact projects ──────────────────────────────────────────────────────

function buildHighImpactProjects(allTasks: GrowthPlanTask[]): GrowthPlanTask[] {
  return allTasks.filter(t =>
    t.estimated_impact === "high" &&
    (t.difficulty === "moderate" || t.difficulty === "advanced") &&
    (t.due_window === "60_days" || t.due_window === "90_days")
  ).slice(0, 8);
}

// ── 30 / 60 / 90 day bucketing ────────────────────────────────────────────────

function bucketByWindow(tasks: GrowthPlanTask[], window: DueWindow): GrowthPlanTask[] {
  return tasks
    .filter(t => t.due_window === window)
    .sort((a, b) => {
      const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3);
    });
}

// ── Compliance review ─────────────────────────────────────────────────────────

function buildComplianceItems(ctx: GrowthPlanContext): ComplianceReviewItem[] {
  if (!ctx.hipaaRequired) return [];
  const items: ComplianceReviewItem[] = [
    {
      item: "Review all testimonials for HIPAA compliance",
      reason: "Patient testimonials that include identifiable health information may require written authorization.",
      recommendation: "Obtain written HIPAA-compliant authorization from patients before publishing testimonials that mention specific conditions or treatments.",
      severity: "flag",
    },
    {
      item: "Review before/after images and case studies",
      reason: "Before/after images are regulated in healthcare contexts and may require both patient consent and FTC compliance.",
      recommendation: "Have all before/after content reviewed by a healthcare compliance advisor or attorney before publishing.",
      severity: "flag",
    },
    {
      item: "Review outcome language on service pages",
      reason: "Language that implies guaranteed outcomes (e.g., 'You will feel better', 'Our treatment cures...') may violate FTC or medical advertising guidelines.",
      recommendation: "Use qualifying language ('may', 'results vary', 'individual outcomes differ') and avoid guarantee claims.",
      severity: "review",
    },
    {
      item: "Verify contact forms are HIPAA-compliant",
      reason: "Contact forms that collect health information (symptoms, conditions, treatment needs) may require HIPAA-compliant form handling.",
      recommendation: "Use a HIPAA-compliant form provider or add appropriate disclaimers. Ensure form data is encrypted and stored securely.",
      severity: "flag",
    },
  ];
  if (ctx.complianceNotes) {
    items.push({
      item: "Practice-specific compliance notes",
      reason: ctx.complianceNotes,
      recommendation: "Review all content recommendations against these specific compliance requirements before publishing.",
      severity: "review",
    });
  }
  return items;
}

// ── Phase roadmap builder ─────────────────────────────────────────────────────

function buildPhaseRoadmap(
  key: string,
  label: string,
  report: FullReport,
  tasks: GrowthPlanTask[]
): PhaseRoadmap {
  const phase = report.five_phase_analysis[key as keyof typeof report.five_phase_analysis];
  const current = phase?.score ?? 0;
  const missing = phase?.missing_data ?? [];
  const fixes = phase?.priority_fixes ?? [];

  return {
    phase: key,
    phase_label: label,
    current_score: current,
    target_score: targetScore(current),
    main_weakness: fixes[0] || "See findings above",
    main_opportunity: phase?.estimated_impact || "Improvements in this phase will improve your overall Authority Score",
    actions: tasks,
    expected_impact: phase?.estimated_impact || "Moderate to significant score improvement",
    difficulty: tasks.some(t => t.difficulty === "advanced") ? "advanced" : tasks.some(t => t.difficulty === "moderate") ? "moderate" : "easy",
    suggested_owner: "SEO specialist / marketing team",
    timeline: current < 50 ? "2–4 months" : current < 70 ? "1–3 months" : "1–2 months",
    data_needed: missing,
    completion_criteria: `Phase score reaches ${targetScore(current)}+`,
  };
}

// ── Missing data list ─────────────────────────────────────────────────────────

function buildMissingDataList(ctx: GrowthPlanContext): string[] {
  const items: string[] = [...ctx.missingOptionalData];
  if (!ctx.hasGsc) items.push("Google Search Console data — enables keyword gap analysis");
  if (!ctx.hasGa) items.push("Google Analytics data — enables traffic and conversion analysis");
  if (!ctx.hasCompetitorAnalysis) items.push("Competitor analysis — enables gap-closing content recommendations");
  if (!ctx.hasGbp) items.push("Google Business Profile URL — enables local authority analysis");
  if (!ctx.revenueServices.length) items.push("Revenue priority services — enables revenue-aligned prioritization");
  return items;
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildGrowthPlanActions(ctx: GrowthPlanContext): Omit<GrowthPlanJson, "executive_summary" | "growth_strategy"> {
  const report = ctx.report;

  const foundationTasks = buildFoundationTasks(ctx);
  const localTasks = buildLocalAuthorityTasks(ctx);
  const serviceTasks = buildServiceAuthorityTasks(ctx);
  const trustTasks = buildTrustConversionTasks(ctx);
  const compTasks = buildCompetitiveAiTasks(ctx);

  const allTasks = [...foundationTasks, ...localTasks, ...serviceTasks, ...trustTasks, ...compTasks];

  const quickWins = buildQuickWins(ctx, allTasks);
  const highImpact = buildHighImpactProjects(allTasks);

  const thirtyDay = bucketByWindow(allTasks, "30_days");
  const sixtyDay = bucketByWindow(allTasks, "60_days");
  const ninetyDay = bucketByWindow(allTasks, "90_days");

  const priorityActions = allTasks
    .filter(t => t.priority === "critical" || t.priority === "high")
    .sort((a, b) => {
      const p = { critical: 0, high: 1, medium: 2, low: 3 };
      return (p[a.priority] ?? 3) - (p[b.priority] ?? 3);
    })
    .slice(0, 15);

  const scores = report.scores;
  const currentScores = {
    authority_score: scores.authority_score,
    foundation_score: scores.foundation_score,
    local_authority_score: scores.local_authority_score,
    service_authority_score: scores.service_authority_score,
    trust_conversion_score: scores.trust_conversion_score,
    competitive_ai_score: scores.competitive_ai_score,
  };

  const phaseLabels: Record<string, string> = {
    foundation: "Foundation",
    local_authority: "Local Authority",
    service_authority: "Service Authority",
    trust_conversion: "Trust & Conversion",
    competitive_ai_visibility: "Competitive & AI Visibility",
  };

  const phaseTaskMap: Record<string, GrowthPlanTask[]> = {
    foundation: foundationTasks,
    local_authority: localTasks,
    service_authority: serviceTasks,
    trust_conversion: trustTasks,
    competitive_ai_visibility: compTasks,
  };

  const confidence = report.confidence;
  const limitations: string[] = [];
  if (!ctx.hasGsc) limitations.push("Search Console data not available — keyword recommendations are based on scan signals only");
  if (!ctx.hasGa) limitations.push("Analytics data not available — traffic-based recommendations are inferred");
  if (!ctx.hasCompetitorAnalysis) limitations.push("Competitor analysis not completed — competitive gap tasks are general until analysis runs");
  if (confidence.level === "low") limitations.push("Limited intake data — some recommendations are based on scan signals alone");

  return {
    plan_version: "1.0",
    plan_type: "personal_authority_growth_plan",
    project: {
      id: String(ctx.project.id ?? ""),
      name: String(ctx.project.name ?? ""),
      website_url: String(ctx.project.website_url ?? ""),
      clinic_type: String(ctx.project.clinic_type ?? ""),
      location: String(ctx.project.location ?? ""),
    },
    source_report_id: report.report_type ? String((report as unknown as Record<string, unknown>).id ?? "") : "",
    generated_at: new Date().toISOString(),
    current_scores: currentScores,
    target_scores: {
      authority_score: targetScore(scores.authority_score),
      foundation_score: targetScore(scores.foundation_score),
      local_authority_score: targetScore(scores.local_authority_score),
      service_authority_score: targetScore(scores.service_authority_score),
      trust_conversion_score: targetScore(scores.trust_conversion_score),
      competitive_ai_score: targetScore(scores.competitive_ai_score),
    },
    confidence: {
      level: confidence.level,
      score: confidence.score,
      limitations,
    },
    phase_roadmap: {
      foundation: buildPhaseRoadmap("foundation", phaseLabels.foundation, report, phaseTaskMap.foundation),
      local_authority: buildPhaseRoadmap("local_authority", phaseLabels.local_authority, report, phaseTaskMap.local_authority),
      service_authority: buildPhaseRoadmap("service_authority", phaseLabels.service_authority, report, phaseTaskMap.service_authority),
      trust_conversion: buildPhaseRoadmap("trust_conversion", phaseLabels.trust_conversion, report, phaseTaskMap.trust_conversion),
      competitive_ai_visibility: buildPhaseRoadmap("competitive_ai_visibility", phaseLabels.competitive_ai_visibility, report, phaseTaskMap.competitive_ai_visibility),
    },
    thirty_day_plan: thirtyDay,
    sixty_day_plan: sixtyDay,
    ninety_day_plan: ninetyDay,
    priority_actions: priorityActions,
    quick_wins: quickWins,
    high_impact_projects: highImpact,
    content_plan: serviceTasks.filter(t => t.title.toLowerCase().includes("content") || t.title.toLowerCase().includes("page") || t.title.toLowerCase().includes("faq")),
    local_seo_plan: localTasks,
    conversion_plan: trustTasks,
    ai_visibility_plan: compTasks,
    compliance_review_items: buildComplianceItems(ctx),
    missing_data: buildMissingDataList(ctx),
    implementation_notes: [
      "Tasks are ordered by priority. Complete critical and high-priority 30-day tasks first.",
      "Quick wins can be completed in parallel by any available team member.",
      "High Impact Projects require dedicated time blocks — schedule them as sprints.",
      confidence.level === "low" ? "Confidence is low due to limited data. Run more scans and complete the intake to improve recommendation accuracy." : "",
    ].filter(Boolean),
    disclaimers: report.disclaimers ?? [],
  };
}
