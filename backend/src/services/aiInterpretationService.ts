/**
 * AI Interpretation Service — LLM-powered analysis layer
 *
 * Takes rule engine findings + extracted signals and produces:
 * - Executive summary
 * - Section-level system insights
 * - Strategic implications
 * - Recommended directions
 *
 * Uses OpenAI (GPT-4o) or compatible API.
 */

import OpenAI from "openai";
import type { SiteExtraction } from "./extractService.js";
import type { RuleEngineResult } from "./ruleEngine.js";
import type { ScanScores } from "../types/scanReport.js";
import { logger } from "../lib/logger.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.AI_MODEL || "gpt-4o";

export interface AIInterpretation {
  executive_summary: string;
  visibility_insight: string;
  visibility_strategic: string;
  visibility_directions: string[];
  conversion_insight: string;
  conversion_strategic: string;
  conversion_directions: string[];
  opportunity_insight: string;
  opportunity_strategic: string;
  opportunity_directions: string[];
  visibility_summary: string;
  conversion_summary: string;
  opportunity_summary: string;
}

export async function generateInterpretation(
  websiteUrl: string,
  clinicType: string,
  location: string,
  extraction: SiteExtraction,
  rules: RuleEngineResult,
  scores: ScanScores
): Promise<AIInterpretation> {
  const prompt = buildPrompt(websiteUrl, clinicType, location, extraction, rules, scores);

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a healthcare digital marketing analyst for Authority Gap Engine™. 
You produce precise, data-grounded analysis for medical practices. 
Your tone is professional, authoritative, and strategic — never salesy.
Always respond with valid JSON matching the requested schema.`,
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");

    return JSON.parse(content) as AIInterpretation;
  } catch (err) {
    logger.error(err, "AI interpretation failed, using fallback");
    return getFallbackInterpretation(websiteUrl, clinicType, rules);
  }
}

function buildPrompt(
  url: string,
  clinicType: string,
  location: string,
  extraction: SiteExtraction,
  rules: RuleEngineResult,
  scores: ScanScores
): string {
  return `Analyze this ${clinicType} practice website (${url}) in ${location}.

SCORES: ${JSON.stringify(scores)}

VISIBILITY FINDINGS:
${rules.visibilityFindings.map((f) => `- [${f.severity}] ${f.label}: ${f.description}`).join("\n")}

CONVERSION FINDINGS:
${rules.conversionFindings.map((f) => `- [${f.severity}] ${f.label}: ${f.description}`).join("\n")}

SITE DATA:
- Pages crawled: ${extraction.sitewide.totalPages}
- Avg word count: ${extraction.sitewide.avgWordCount}
- Total CTAs: ${extraction.sitewide.totalCtas}
- Has local schema: ${extraction.sitewide.hasLocalSchema}
- Has medical schema: ${extraction.sitewide.hasMedicalSchema}

Return JSON with these exact keys:
{
  "executive_summary": "2-3 sentence overview of the authority gap",
  "visibility_summary": "1-2 sentence section summary",
  "visibility_insight": "System-level observation about visibility gaps",
  "visibility_strategic": "Strategic implication for patient acquisition",
  "visibility_directions": ["3 specific recommended actions"],
  "conversion_summary": "1-2 sentence section summary",
  "conversion_insight": "System-level observation about conversion gaps",
  "conversion_strategic": "Strategic implication",
  "conversion_directions": ["3 specific recommended actions"],
  "opportunity_summary": "1-2 sentence revenue opportunity summary",
  "opportunity_insight": "System-level observation about revenue potential",
  "opportunity_strategic": "Strategic implication",
  "opportunity_directions": ["3 specific recommended actions"]
}`;
}

function getFallbackInterpretation(
  url: string,
  clinicType: string,
  rules: RuleEngineResult
): AIInterpretation {
  const highCount =
    [...rules.visibilityFindings, ...rules.conversionFindings].filter(
      (f) => f.severity === "high"
    ).length;

  return {
    executive_summary: `${url} presents ${highCount > 2 ? "significant" : "moderate"} authority gaps across search visibility and conversion pathways.`,
    visibility_summary: "Search visibility is constrained by structural content and technical gaps.",
    visibility_insight: "Visibility gaps are structural — not cosmetic.",
    visibility_strategic: "Without local search presence, the practice relies disproportionately on referrals.",
    visibility_directions: [
      "Create location-specific service pages",
      "Implement structured data markup",
      "Expand content depth on service pages",
    ],
    conversion_summary: "Conversion infrastructure has room for meaningful improvement.",
    conversion_insight: "The conversion gap is the most actionable area.",
    conversion_strategic: "Traffic gains will underperform unless conversion infrastructure is strengthened.",
    conversion_directions: [
      "Add prominent CTAs to service pages",
      "Display trust signals and credentials",
      "Implement mobile conversion elements",
    ],
    opportunity_summary: `Revenue opportunity exists through improved visibility and conversion optimization for ${clinicType} in this market.`,
    opportunity_insight: "The opportunity range accounts for competitive variance and implementation quality.",
    opportunity_strategic: "Conservative implementation would likely yield positive ROI within the first quarter.",
    opportunity_directions: [
      "Prioritize high-intent keyword targeting",
      "Combine visibility with conversion improvements",
      "Track acquisition sources to validate projections",
    ],
  };
}
