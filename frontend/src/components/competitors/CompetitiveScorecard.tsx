import type { CompetitiveGapAnalysis } from "@/lib/competitorsApi";

interface Props {
  analysis: CompetitiveGapAnalysis;
}

const SCORE_KEYS: { key: keyof CompetitiveGapAnalysis["target_scores"]; label: string }[] = [
  { key: "service_coverage", label: "Service Coverage" },
  { key: "local_authority", label: "Local Authority" },
  { key: "trust_signals", label: "Trust Signals" },
  { key: "content_depth", label: "Content Depth" },
  { key: "conversion_clarity", label: "Conversion Clarity" },
  { key: "schema_coverage", label: "Schema Coverage" },
  { key: "review_strength", label: "Review Strength" },
  { key: "ai_visibility", label: "AI Visibility" },
];

const GAP_LABEL_COLORS: Record<string, string> = {
  "Strong Advantage": "text-success bg-success/10",
  "Competitive": "text-primary bg-primary/10",
  "Moderate Gap": "text-orange-600 bg-orange-50",
  "Major Gap": "text-destructive bg-destructive/10",
};

function ScoreBar({ value, compValue }: { value: number; compValue: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] font-bold text-foreground w-6 text-right">{value}</span>
      <span className="text-[10px] text-muted-foreground w-5 text-right">{compValue}</span>
    </div>
  );
}

export default function CompetitiveScorecard({ analysis }: Props) {
  const { competitive_strength_score, gap_label } = analysis;
  const labelColor = GAP_LABEL_COLORS[gap_label] ?? "text-muted-foreground bg-muted";

  return (
    <div className="space-y-5">
      {/* Overall score */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/20">
        <div className="flex flex-col items-center justify-center w-20 h-20 rounded-xl bg-background border border-border shadow-sm">
          <span className="text-[28px] font-extrabold leading-none text-foreground">{competitive_strength_score}</span>
          <span className="text-[9px] text-muted-foreground mt-0.5">of 100</span>
        </div>
        <div>
          <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold ${labelColor}`}>
            {gap_label}
          </div>
          <p className="text-[12px] text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
            {analysis.overall_competitive_summary || "Analysis in progress…"}
          </p>
        </div>
      </div>

      {/* Per-dimension scores */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Score Breakdown</p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary inline-block" /> You</span>
            <span className="text-muted-foreground/50">Comp avg</span>
          </div>
        </div>
        <div className="space-y-2.5">
          {SCORE_KEYS.map(({ key, label }) => (
            <div key={key}>
              <div className="flex justify-between mb-0.5">
                <span className="text-[11px] text-foreground">{label}</span>
              </div>
              <ScoreBar
                value={analysis.target_scores[key] ?? 0}
                compValue={analysis.competitor_avg_scores[key] ?? 0}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Gap/advantage chips */}
      {analysis.major_gaps.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-destructive mb-1.5">Major Gaps</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.major_gaps.map(g => (
              <span key={g} className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">{g}</span>
            ))}
          </div>
        </div>
      )}
      {analysis.target_advantages.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-success mb-1.5">Your Advantages</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.target_advantages.map(a => (
              <span key={a} className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">{a}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
