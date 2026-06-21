import type { CompetitiveGapAnalysis, ComparisonRow } from "@/lib/competitorsApi";

const GAP_STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  advantage: { badge: "bg-success/10 text-success", label: "Advantage" },
  competitive: { badge: "bg-primary/10 text-primary", label: "Competitive" },
  moderate_gap: { badge: "bg-orange-100 text-orange-700", label: "Moderate Gap" },
  major_gap: { badge: "bg-destructive/10 text-destructive", label: "Major Gap" },
};

function Row({ row }: { row: ComparisonRow }) {
  const style = GAP_STATUS_STYLES[row.gap_status] ?? GAP_STATUS_STYLES.competitive;
  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
      <td className="py-3 px-4 text-[12px] font-semibold text-foreground">{row.category}</td>
      <td className="py-3 px-4 text-[12px] text-foreground text-center font-medium">{row.target}</td>
      <td className="py-3 px-4 text-[12px] text-muted-foreground text-center">{row.competitor_avg}</td>
      <td className="py-3 px-4 text-[12px] text-muted-foreground text-center">{row.strongest_competitor}</td>
      <td className="py-3 px-4 text-center">
        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
          {style.label}
        </span>
      </td>
      <td className="py-3 px-4 text-[11px] text-muted-foreground max-w-[200px]">{row.recommended_action}</td>
    </tr>
  );
}

export default function ComparisonTable({ analysis }: { analysis: CompetitiveGapAnalysis }) {
  const rows: ComparisonRow[] = [
    analysis.service_coverage_comparison,
    analysis.local_authority_comparison,
    analysis.trust_signal_comparison,
    analysis.conversion_comparison,
    analysis.content_depth_comparison,
    analysis.schema_comparison,
    analysis.review_comparison,
  ].filter(Boolean);

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="bg-muted/40 border-b border-border">
            <th className="py-2.5 px-4 text-left text-[10px] uppercase tracking-wide font-extrabold text-muted-foreground">Category</th>
            <th className="py-2.5 px-4 text-center text-[10px] uppercase tracking-wide font-extrabold text-primary">You</th>
            <th className="py-2.5 px-4 text-center text-[10px] uppercase tracking-wide font-extrabold text-muted-foreground">Comp Avg</th>
            <th className="py-2.5 px-4 text-center text-[10px] uppercase tracking-wide font-extrabold text-muted-foreground">Strongest</th>
            <th className="py-2.5 px-4 text-center text-[10px] uppercase tracking-wide font-extrabold text-muted-foreground">Status</th>
            <th className="py-2.5 px-4 text-left text-[10px] uppercase tracking-wide font-extrabold text-muted-foreground">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => <Row key={i} row={row} />)}
        </tbody>
      </table>
    </div>
  );
}
