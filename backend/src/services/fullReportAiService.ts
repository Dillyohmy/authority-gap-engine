/**
 * Full Authority Gap Report — AI Interpretation Layer
 * Runs AFTER deterministic scoring. Summarizes and adds strategic language.
 */

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger.js";
import type { ReportContext } from "../types/fullReport.js";
import type { PhaseAnalysis, FullReportScores } from "../types/fullReport.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AiReportInterpretation {
  executive_summary: string;
  foundation_summary: string;
  local_authority_summary: string;
  service_authority_summary: string;
  trust_conversion_summary: string;
  competitive_ai_summary: string;
  opportunity_summary: string;
  top_opportunities: string[];
  strategic_implications: string;
}

function buildPrompt(
  ctx: ReportContext,
  scores: FullReportScores,
  phases: Record<string, PhaseAnalysis>
): string {
  const businessName = ctx.project.business_name || ctx.project.name || "the practice";
  const clinicType = ctx.project.clinic_type || "healthcare practice";
  const location = ctx.project.location || "the service area";

  // Summarize phases to avoid huge prompts
  const phaseSummaries = Object.entries(phases).map(([key, phase]) => {
    return `${key.toUpperCase()} (${phase.score}/100): ${phase.summary}
  Gaps: ${phase.missing_data.slice(0, 3).join(", ") || "none"}
  Top fixes: ${phase.priority_fixes.slice(0, 2).join("; ") || "none"}`;
  }).join("\n\n");

  const competitiveNote = ctx.gapAnalysis
    ? `Competitive strength: ${(ctx.gapAnalysis.competitive_strength_score as number) ?? "N/A"}/100. Gap label: ${(ctx.gapAnalysis.gap_label as string) ?? "N/A"}.`
    : "No competitive analysis available.";

  const dataNote = ctx.scanReport ? "Website scan is available." : "No website scan available — findings are based on intake and uploaded data only.";

  return `You are an authority gap analyst for a ${clinicType} practice located in ${location}.
Business name: ${businessName}
Website: ${ctx.project.website_url || "Not provided"}

AUTHORITY SCORE: ${scores.authority_score}/100
FOUNDATION: ${scores.foundation_score}/100
LOCAL AUTHORITY: ${scores.local_authority_score}/100
SERVICE AUTHORITY: ${scores.service_authority_score}/100
TRUST & CONVERSION: ${scores.trust_conversion_score}/100
COMPETITIVE & AI VISIBILITY: ${scores.competitive_ai_score}/100

${dataNote}
${competitiveNote}

PHASE FINDINGS:
${phaseSummaries}

Rules:
- Do NOT invent competitor review counts, rankings, or services not in the data
- If data is missing, explicitly say confidence is limited
- Do not make revenue guarantees or medical claims
- For healthcare clients: note that content recommendations should be reviewed for compliance before publication
- Use plain business language — avoid jargon where possible

Return JSON with exactly these keys:
{
  "executive_summary": "3-4 sentences. Overall authority gap position, the most critical gap, and the biggest opportunity. Reference actual scores.",
  "foundation_summary": "1-2 sentences on foundation state.",
  "local_authority_summary": "1-2 sentences on local authority state.",
  "service_authority_summary": "1-2 sentences on service authority state.",
  "trust_conversion_summary": "1-2 sentences on trust and conversion state.",
  "competitive_ai_summary": "1-2 sentences on competitive and AI visibility state.",
  "opportunity_summary": "2-3 sentences on the biggest growth opportunity available with current data.",
  "top_opportunities": ["3 specific, actionable opportunity statements — no generic advice"],
  "strategic_implications": "2-3 sentences on what fixing these gaps would mean for patient acquisition and revenue."
}`;
}

export async function generateFullReportAiInterpretation(
  ctx: ReportContext,
  scores: FullReportScores,
  phases: Record<string, PhaseAnalysis>
): Promise<AiReportInterpretation> {
  const prompt = buildPrompt(ctx, scores, phases);

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      system: `You are Authority Gap Engine™'s senior analyst. You produce precise, data-grounded strategic analysis.
Your tone is professional, clear, and useful for both business owners and marketing teams.
Always respond with valid JSON only. No markdown fences. No explanation outside the JSON.`,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    if (!block || block.type !== "text") throw new Error("Empty AI response");
    return JSON.parse(block.text) as AiReportInterpretation;
  } catch (err) {
    logger.warn({ err }, "AI full report interpretation failed — using fallback");
    return buildFallback(ctx, scores, phases);
  }
}

function buildFallback(
  ctx: ReportContext,
  scores: FullReportScores,
  phases: Record<string, PhaseAnalysis>
): AiReportInterpretation {
  const business = ctx.project.business_name || "This practice";
  const lowest = Object.entries(phases).sort((a, b) => a[1].score - b[1].score)[0];
  const highest = Object.entries(phases).sort((a, b) => b[1].score - a[1].score)[0];

  return {
    executive_summary: `${business} has an overall authority score of ${scores.authority_score}/100. The weakest area is ${lowest?.[0].replace(/_/g, " ")} (${lowest?.[1].score}/100), which represents the highest priority for improvement. ${highest?.[1].score && highest[1].score > 60 ? `${highest[0].replace(/_/g, " ")} is a relative strength at ${highest[1].score}/100.` : "Multiple areas need attention."} This report was generated with ${ctx.scanReport ? "website scan data" : "limited data — a website scan is strongly recommended"}.`,
    foundation_summary: phases.foundation?.summary ?? "Foundation analysis not available.",
    local_authority_summary: phases.local_authority?.summary ?? "Local authority analysis not available.",
    service_authority_summary: phases.service_authority?.summary ?? "Service authority analysis not available.",
    trust_conversion_summary: phases.trust_conversion?.summary ?? "Trust and conversion analysis not available.",
    competitive_ai_summary: phases.competitive_ai_visibility?.summary ?? "Competitive analysis not available.",
    opportunity_summary: `The biggest opportunity for ${business} is addressing gaps in ${lowest?.[0].replace(/_/g, " ")}. Improving this phase alone could significantly increase search visibility and patient acquisition. Uploading additional data (Search Console, GA, competitor information) would enable a more precise opportunity estimate.`,
    top_opportunities: [
      phases.foundation?.priority_fixes?.[0] ?? "Complete intake and run website scan",
      phases.local_authority?.priority_fixes?.[0] ?? "Add Google Business Profile URL",
      phases.service_authority?.priority_fixes?.[0] ?? "Upload Search Console data",
    ].filter(Boolean),
    strategic_implications: `Fixing the identified gaps would improve both organic search visibility and conversion rate, directly impacting new patient acquisition. ${ctx.gapAnalysis ? "Competitive analysis is available and should guide prioritization." : "Running competitor analysis would add strategic context to these recommendations."}`,
  };
}
