import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, AlertTriangle, CheckCircle2, HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { MissingInputsList } from "./MissingInputsList";
import { PriorityFixesList } from "./PriorityFixesList";
import { GrowthPlanTaskList } from "./GrowthPlanTaskList";
import type { DashboardPhaseData } from "@/lib/dashboardApi";

interface Props {
  phase: DashboardPhaseData;
  projectId: string;
  hasGrowthPlan: boolean;
  onGenerateGrowthPlan?: () => void;
}

function ScoreRingSmall({ score, status }: { score: number | null; status: string }) {
  const color =
    status === "strong" ? "#059669" :
    status === "good" ? "#2563eb" :
    status === "needs_work" ? "#d97706" :
    status === "critical" ? "#dc2626" : "#94a3b8";

  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score !== null ? Math.min(100, Math.max(0, score)) : 0;
  const dash = (pct / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        {score !== null && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="absolute text-lg font-bold tabular-nums" style={{ color }}>
        {score !== null ? score : "—"}
      </span>
    </div>
  );
}

function statusLabel(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    strong: { label: "Strong", color: "text-emerald-600" },
    good: { label: "Good", color: "text-blue-600" },
    needs_work: { label: "Needs Work", color: "text-amber-600" },
    critical: { label: "Critical", color: "text-red-600" },
    unknown: { label: "Not Scored", color: "text-muted-foreground" },
  };
  return map[status] ?? map.unknown;
}

function Section({ title, count, children, defaultOpen = true }: { title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left py-2"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className="font-semibold text-sm">{title}</span>
        {count !== undefined && (
          <Badge variant="secondary" className="text-xs ml-1">{count}</Badge>
        )}
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

export function PhaseTabContent({ phase, projectId, hasGrowthPlan, onGenerateGrowthPlan }: Props) {
  const navigate = useNavigate();
  const sl = statusLabel(phase.score_status);
  const taskCount = phase.growth_plan_tasks.length;
  const completedTasks = phase.growth_plan_tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="space-y-0">
      {/* Phase header */}
      <div className="flex items-start gap-6 pb-5">
        <ScoreRingSmall score={phase.score} status={phase.score_status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold">{phase.phase_label}</h3>
            <span className={`text-sm font-medium ${sl.color}`}>{sl.label}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{phase.why_it_matters}</p>
          {phase.summary && phase.summary !== phase.why_it_matters && (
            <p className="text-sm mt-2 leading-relaxed">{phase.summary}</p>
          )}
        </div>
      </div>

      {/* Task progress bar (if growth plan exists) */}
      {taskCount > 0 && (
        <div className="bg-muted/30 rounded-lg px-4 py-3 mb-4">
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="font-medium">Growth Plan Progress</span>
            <span className="text-muted-foreground">{completedTasks}/{taskCount} tasks done</span>
          </div>
          <Progress value={taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0} className="h-2" />
        </div>
      )}

      <Separator className="mb-4" />

      {/* Findings */}
      {phase.findings.length > 0 && (
        <Section title="What We Found" count={phase.findings.length} defaultOpen={true}>
          <div className="space-y-2">
            {phase.findings.map((f) => {
              const sev = f.severity as string;
              const sevCls =
                sev === "critical" || sev === "high" ? "text-red-500" :
                sev === "medium" ? "text-amber-500" :
                sev === "positive" ? "text-emerald-500" : "text-slate-400";
              const Icon = sev === "positive" ? CheckCircle2 : sev === "critical" || sev === "high" ? AlertTriangle : HelpCircle;
              return (
                <div key={f.id} className="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${sevCls}`} />
                  <div>
                    <p className="text-sm font-medium">{f.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Missing inputs */}
      {phase.missing_inputs.length > 0 && (
        <>
          <Separator className="my-2" />
          <Section title="Missing Inputs" count={phase.missing_inputs.length} defaultOpen={true}>
            <MissingInputsList items={phase.missing_inputs} />
          </Section>
        </>
      )}

      {/* Priority fixes */}
      <>
        <Separator className="my-2" />
        <Section title="Priority Fixes" count={phase.priority_fixes.length} defaultOpen={true}>
          <PriorityFixesList fixes={phase.priority_fixes} />
        </Section>
      </>

      {/* Growth plan tasks */}
      <>
        <Separator className="my-2" />
        <Section title="Growth Plan Tasks" count={taskCount} defaultOpen={taskCount > 0}>
          {!hasGrowthPlan ? (
            <div className="text-center py-5 rounded-lg border border-dashed">
              <TrendingUp className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium mb-1">No growth plan yet</p>
              <p className="text-xs text-muted-foreground mb-3">Generate your Personal Authority Growth Plan to unlock step-by-step action items for this phase.</p>
              {onGenerateGrowthPlan && (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onGenerateGrowthPlan}>
                  Generate Growth Plan
                </Button>
              )}
            </div>
          ) : (
            <GrowthPlanTaskList tasks={phase.growth_plan_tasks} projectId={projectId} />
          )}
        </Section>
      </>

      {/* Impact + next step */}
      <Separator className="my-2" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="rounded-lg bg-muted/30 px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Estimated Impact</p>
          <p className="text-sm">{phase.estimated_impact}</p>
        </div>
        <div className="rounded-lg bg-muted/30 px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Recommended Next Step</p>
          <p className="text-sm">{phase.recommended_next_step}</p>
        </div>
      </div>
    </div>
  );
}
