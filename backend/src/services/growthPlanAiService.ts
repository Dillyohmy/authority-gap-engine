/**
 * Growth Plan AI Service — Claude generates executive summary and growth strategy.
 * Deterministic actions are already built by growthPlanService.ts.
 * This layer only adds narrative, not new facts.
 */

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger.js";
import type { GrowthPlanContext } from "../types/growthPlan.js";
import type { GrowthStrategy } from "../types/growthPlan.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AiGrowthPlanInterpretation {
  executive_summary: string;
  growth_strategy: GrowthStrategy;
}

function buildPrompt(ctx: GrowthPlanContext, taskCount: number, quickWinCount: number): string {
  const biz = ctx.project.business_name || ctx.project.name || "this practice";
  const clinicType = ctx.project.clinic_type || "healthcare practice";
  const location = ctx.project.location || "the service area";
  const scores = ctx.report.scores;
  const revenue = ctx.revenueServices.length
    ? `Top revenue services: ${ctx.revenueServices.slice(0, 4).join(", ")}.`
    : "Revenue service priorities not specified in intake.";
  const cta = ctx.preferredCta ? `Preferred patient CTA: ${ctx.preferredCta}.` : "";
  const compliance = ctx.hipaaRequired
    ? "IMPORTANT: This is a healthcare practice. All content recommendations require compliance review before publication."
    : "";

  const lowestPhase = Object.entries(ctx.report.five_phase_analysis)
    .sort(([, a], [, b]) => a.score - b.score)[0];
  const highestPhase = Object.entries(ctx.report.five_phase_analysis)
    .sort(([, a], [, b]) => b.score - a.score)[0];

  return `You are a senior growth strategist for Authority Gap Engine™.

Practice: ${biz} — ${clinicType} in ${location}
Website: ${ctx.report.project?.website_url || "Not provided"}
${revenue}
${cta}
${compliance}

CURRENT AUTHORITY SCORES:
- Overall: ${scores.authority_score}/100
- Foundation: ${scores.foundation_score}/100
- Local Authority: ${scores.local_authority_score}/100
- Service Authority: ${scores.service_authority_score}/100
- Trust & Conversion: ${scores.trust_conversion_score}/100
- Competitive & AI: ${scores.competitive_ai_score}/100

WEAKEST AREA: ${lowestPhase?.[0].replace(/_/g, " ")} (${lowestPhase?.[1].score ?? 0}/100)
STRONGEST AREA: ${highestPhase?.[0].replace(/_/g, " ")} (${highestPhase?.[1].score ?? 0}/100)

PLAN STATS:
- Total action tasks generated: ${taskCount}
- Quick wins available: ${quickWinCount}
- Data confidence: ${ctx.report.confidence?.level ?? "unknown"}
- Missing data: ${ctx.report.confidence?.data_sources_missing?.join(", ") || "none noted"}

Rules:
- Do NOT invent competitor data, rankings, or facts not in the data
- If data is limited, acknowledge it — do not overstate confidence
- Be specific to this practice's situation, not generic SEO advice
- Do not make revenue guarantees or medical claims
- For healthcare clients: note compliance review requirement where relevant

Return JSON with exactly these keys (no markdown fences, no extra keys):
{
  "executive_summary": "3-4 sentences. Specific to this practice. Cover: where they stand now (reference actual authority score), the most critical gap, the biggest opportunity, and what this plan delivers.",
  "growth_strategy": {
    "headline": "A single punchy headline for this growth plan (max 12 words)",
    "approach": "2-3 sentences describing the overall strategic approach — what to fix first and why, based on their specific scores",
    "sequencing_rationale": "2 sentences on why the task sequence is ordered as it is — what unlocks what",
    "primary_focus": "The #1 phase or area to focus on first (1 sentence)",
    "secondary_focus": "The #2 priority after primary focus is addressed (1 sentence)",
    "revenue_alignment": "1-2 sentences on how this plan is aligned to patient acquisition and revenue (reference their services if available)",
    "confidence_note": "1 sentence on data confidence and how it affects recommendation quality"
  }
}`;
}

function buildFallback(ctx: GrowthPlanContext): AiGrowthPlanInterpretation {
  const biz = ctx.project.business_name || "This practice";
  const scores = ctx.report.scores;
  const allPhases = ctx.report.five_phase_analysis;
  const lowest = Object.entries(allPhases).sort(([, a], [, b]) => a.score - b.score)[0];
  const level = ctx.report.confidence?.level ?? "medium";

  return {
    executive_summary: `${biz} currently holds an authority score of ${scores.authority_score}/100. The most critical gap is in ${lowest?.[0].replace(/_/g, " ")} (${lowest?.[1].score ?? 0}/100), which represents the highest-leverage area for improvement. This growth plan outlines a prioritized action roadmap across all five authority phases to close those gaps systematically and improve both search visibility and patient acquisition.`,
    growth_strategy: {
      headline: `Close the ${lowest?.[0].replace(/_/g, " ")} gap first`,
      approach: `Begin with the highest-priority quick wins — these can be completed without specialists and deliver immediate impact. Then move into structured content and local SEO work in the 60- and 90-day windows.`,
      sequencing_rationale: "Foundation and trust tasks are sequenced first because they affect every other phase — good technical structure and clear CTAs amplify every other improvement you make.",
      primary_focus: `Focus first on ${lowest?.[0].replace(/_/g, " ")} — this is the lowest-scoring phase and the biggest single lever for overall authority score improvement.`,
      secondary_focus: "After foundation gaps are addressed, shift focus to local authority and service content to capture more search demand.",
      revenue_alignment: ctx.revenueServices.length > 0
        ? `This plan prioritizes pages and tasks aligned with ${ctx.revenueServices.slice(0, 2).join(" and ")} — the services with the highest revenue potential identified in intake.`
        : "Revenue alignment will improve once you add your top revenue services in the intake form — this unlocks service-specific prioritization.",
      confidence_note: level === "low"
        ? "Confidence is limited due to missing intake and scan data — completing the intake and running a full site scan will improve recommendation quality."
        : level === "high"
        ? "Confidence is high — this plan is based on website scan data, intake answers, and uploaded data sources."
        : "Confidence is moderate — a website scan is available but additional data (Search Console, analytics) would sharpen these recommendations.",
    },
  };
}

export async function generateGrowthPlanAiInterpretation(
  ctx: GrowthPlanContext,
  taskCount: number,
  quickWinCount: number
): Promise<AiGrowthPlanInterpretation> {
  const prompt = buildPrompt(ctx, taskCount, quickWinCount);

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1200,
      system: `You are Authority Gap Engine™'s senior growth strategist. You write precise, data-grounded growth plans for healthcare and service businesses.
Your tone is confident, specific, and practical. You never make generic statements or invent data.
Always respond with valid JSON only. No markdown fences. No explanation outside the JSON.`,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    if (!block || block.type !== "text") throw new Error("Empty AI response");
    return JSON.parse(block.text) as AiGrowthPlanInterpretation;
  } catch (err) {
    logger.warn({ err }, "Growth plan AI interpretation failed — using fallback");
    return buildFallback(ctx);
  }
}
