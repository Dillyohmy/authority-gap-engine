import { Badge } from "@/components/ui/badge";
import type { DashboardPriorityFix } from "@/lib/dashboardApi";

interface Props {
  fixes: DashboardPriorityFix[];
}

const PRIORITY_CONFIG = {
  critical: { label: "Critical", cls: "bg-red-100 text-red-700 border-red-200" },
  high: { label: "High", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  medium: { label: "Medium", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { label: "Low", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

const DIFFICULTY_CONFIG = {
  easy: { label: "Easy", cls: "text-emerald-600" },
  moderate: { label: "Moderate", cls: "text-amber-600" },
  advanced: { label: "Advanced", cls: "text-red-600" },
};

export function PriorityFixesList({ fixes }: Props) {
  if (fixes.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No priority fixes found. Generate a Full Authority Gap Report to unlock detailed recommendations.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {fixes.map((fix) => {
        const pCfg = PRIORITY_CONFIG[fix.priority] ?? PRIORITY_CONFIG.medium;
        const dCfg = DIFFICULTY_CONFIG[fix.difficulty] ?? DIFFICULTY_CONFIG.moderate;

        return (
          <div key={fix.id} className="rounded-lg border px-4 py-3 bg-card">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${pCfg.cls}`}>
                    {pCfg.label}
                  </span>
                  <span className={`text-xs font-medium ${dCfg.cls}`}>{dCfg.label}</span>
                  {fix.estimated_impact && (
                    <span className="text-xs text-muted-foreground">Impact: {fix.estimated_impact}</span>
                  )}
                </div>
                <p className="text-sm font-medium">{fix.title}</p>
                {fix.description !== fix.title && (
                  <p className="text-xs text-muted-foreground mt-0.5">{fix.description}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
