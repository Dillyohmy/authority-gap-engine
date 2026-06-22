import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, RefreshCw, Loader2, Download, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, Shield, MapPin,
  Zap, Heart, BarChart3, FileText, Target, Star, Trophy,
  Clock, AlertCircle, Info, TrendingUp, Copy, Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  growthPlansApi,
  type GrowthPlanJson,
  type GrowthPlanTask,
  type PhaseRoadmap,
  type TaskStatus,
  type ComplianceReviewItem,
} from "@/lib/growthPlansApi";

const POLL_MS = 4000;

// ── Score ring ─────────────────────────────────────────────────────────────────

function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color =
    score >= 70 ? "text-emerald-600 border-emerald-500"
    : score >= 45 ? "text-orange-500 border-orange-400"
    : "text-destructive border-destructive";
  const sz = size === "lg" ? "h-24 w-24 text-[32px]" : size === "sm" ? "h-12 w-12 text-[15px]" : "h-16 w-16 text-[22px]";
  return (
    <div className={`${sz} rounded-full border-4 flex flex-col items-center justify-center flex-shrink-0 ${color} bg-background`}>
      <span className="font-extrabold leading-none">{score}</span>
      <span className="text-[8px] font-semibold text-muted-foreground mt-0.5">/ 100</span>
    </div>
  );
}

// ── Priority badge ─────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border border-destructive/30",
  high: "bg-orange-100 text-orange-700 border border-orange-200",
  medium: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  low: "bg-muted text-muted-foreground border border-border",
};
const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-emerald-50 text-emerald-700",
  moderate: "bg-blue-50 text-blue-700",
  advanced: "bg-purple-50 text-purple-700",
};
const WINDOW_STYLES: Record<string, string> = {
  "30_days": "bg-red-50 text-red-700",
  "60_days": "bg-orange-50 text-orange-700",
  "90_days": "bg-blue-50 text-blue-700",
  ongoing: "bg-muted text-muted-foreground",
};
const WINDOW_LABELS: Record<string, string> = {
  "30_days": "30 Days",
  "60_days": "60 Days",
  "90_days": "90 Days",
  ongoing: "Ongoing",
};

// ── Status tracker ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus; label: string; icon: React.ElementType; color: string }[] = [
  { value: "not_started", label: "Not Started", icon: Clock, color: "text-muted-foreground" },
  { value: "in_progress", label: "In Progress", icon: RefreshCw, color: "text-blue-600" },
  { value: "completed", label: "Completed", icon: CheckCircle2, color: "text-emerald-600" },
  { value: "blocked", label: "Blocked", icon: AlertTriangle, color: "text-orange-500" },
  { value: "skipped", label: "Skipped", icon: ChevronDown, color: "text-muted-foreground" },
];

function StatusPicker({
  taskId, currentStatus, onUpdate,
}: {
  taskId: string; currentStatus: TaskStatus; onUpdate: (id: string, status: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = STATUS_OPTIONS.find(o => o.value === currentStatus) ?? STATUS_OPTIONS[0];
  const Icon = current.icon;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border bg-background hover:bg-muted transition-colors ${current.color}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {current.label}
        <ChevronDown className="h-3 w-3 ml-0.5" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 right-0 bg-background border rounded-lg shadow-elevated w-40 py-1">
          {STATUS_OPTIONS.map(opt => {
            const Ico = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => { onUpdate(taskId, opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors ${opt.color} ${currentStatus === opt.value ? "bg-muted font-semibold" : ""}`}
              >
                <Ico className="h-3.5 w-3.5" /> {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Task card ──────────────────────────────────────────────────────────────────

const PHASE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  foundation: { label: "Foundation", icon: Shield, color: "text-blue-600" },
  local_authority: { label: "Local Authority", icon: MapPin, color: "text-emerald-600" },
  service_authority: { label: "Service Authority", icon: FileText, color: "text-purple-600" },
  trust_conversion: { label: "Trust & Conversion", icon: Heart, color: "text-rose-600" },
  competitive_ai_visibility: { label: "Competitive & AI", icon: BarChart3, color: "text-orange-600" },
};

function TaskCard({
  task, onStatusChange, compact = false,
}: {
  task: GrowthPlanTask & { status?: TaskStatus }; onStatusChange: (id: string, status: TaskStatus) => void; compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(!compact);
  const status = task.status ?? "not_started";
  const phase = PHASE_META[task.phase] ?? { label: task.phase, icon: Shield, color: "text-muted-foreground" };
  const PhaseIcon = phase.icon;
  const isCompleted = status === "completed";

  return (
    <Card className={`border shadow-sm rounded-xl overflow-hidden transition-all ${isCompleted ? "opacity-60" : ""}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority] ?? ""}`}>
                  {task.priority.toUpperCase()}
                </span>
                <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${DIFFICULTY_STYLES[task.difficulty] ?? ""}`}>
                  {task.difficulty}
                </span>
                <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${WINDOW_STYLES[task.due_window] ?? ""}`}>
                  {WINDOW_LABELS[task.due_window]}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <PhaseIcon className={`h-3 w-3 ${phase.color}`} />
                  {phase.label}
                </span>
              </div>
              <h4 className={`font-semibold text-sm text-foreground leading-tight ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </h4>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusPicker taskId={task.id} currentStatus={status} onUpdate={onStatusChange} />
            {compact && (
              <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
        {expanded && (
          <div className="mt-3 space-y-2 pl-0">
            <p className="text-sm text-muted-foreground">{task.description}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
              {task.suggested_owner && (
                <span><span className="font-semibold text-foreground">Owner:</span> {task.suggested_owner}</span>
              )}
              {task.estimated_effort && (
                <span><span className="font-semibold text-foreground">Effort:</span> {task.estimated_effort}</span>
              )}
            </div>
            {task.completion_criteria && (
              <div className="mt-2 bg-muted/50 rounded-lg p-2.5">
                <p className="text-xs font-semibold text-foreground mb-0.5">Done when:</p>
                <p className="text-xs text-muted-foreground">{task.completion_criteria}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Phase roadmap section ──────────────────────────────────────────────────────

function PhaseSection({
  phaseKey, phase, taskStatuses, onStatusChange,
}: {
  phaseKey: string; phase: PhaseRoadmap; taskStatuses: Record<string, TaskStatus>; onStatusChange: (id: string, s: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = PHASE_META[phaseKey] ?? { label: phaseKey, icon: Shield, color: "text-muted-foreground" };
  const Icon = meta.icon;
  const completed = phase.actions.filter(t => (taskStatuses[t.id] ?? t.status) === "completed").length;
  const total = phase.actions.length;

  return (
    <Card className="border-0 shadow-elevated rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex flex-col items-center gap-1">
          <ScoreBadge score={phase.current_score} size="sm" />
          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <TrendingUp className="h-2.5 w-2.5 text-emerald-600" />
            <span className="text-emerald-600 font-semibold">{phase.target_score}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Icon className={`h-4 w-4 ${meta.color}`} />
            <span className="font-semibold text-foreground">{phase.phase_label}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{phase.main_weakness}</p>
          {total > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1 bg-muted rounded-full">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(completed / total) * 100}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{completed}/{total}</span>
            </div>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg mb-4 text-xs">
            <div><span className="font-semibold">Timeline:</span> {phase.timeline}</div>
            <div><span className="font-semibold">Target score:</span> {phase.target_score}/100</div>
            <div><span className="font-semibold">Difficulty:</span> {phase.difficulty}</div>
          </div>
          <div className="space-y-2">
            {phase.actions.map(t => (
              <TaskCard
                key={t.id}
                task={{ ...t, status: taskStatuses[t.id] ?? t.status }}
                onStatusChange={onStatusChange}
                compact={true}
              />
            ))}
          </div>
          {phase.data_needed.length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 mb-1">Data needed to unlock more recommendations:</p>
              <ul className="space-y-0.5">
                {phase.data_needed.map((d, i) => <li key={i} className="text-xs text-amber-700">• {d}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Compliance section ─────────────────────────────────────────────────────────

function ComplianceSection({ items }: { items: ComplianceReviewItem[] }) {
  if (!items.length) return null;
  const sev = { flag: "border-destructive/30 bg-destructive/5 text-destructive", review: "border-orange-200 bg-orange-50 text-orange-700", info: "border-blue-200 bg-blue-50 text-blue-700" };
  return (
    <Card className="border-0 shadow-elevated rounded-xl p-5">
      <h3 className="font-bold text-base text-foreground mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-500" /> Compliance Review Required
      </h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className={`rounded-lg border p-3 ${sev[item.severity]}`}>
            <p className="font-semibold text-sm">{item.item}</p>
            <p className="text-xs mt-1 opacity-80">{item.reason}</p>
            <p className="text-xs mt-1 font-medium">{item.recommendation}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function GrowthPlanPage() {
  const { projectId, planId } = useParams<{ projectId: string; planId: string }>();
  const { toast } = useToast();

  const [planRow, setPlanRow] = useState<{ plan_json: GrowthPlanJson | null; plan_status: string; error_message: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus>>({});
  const [activeTab, setActiveTab] = useState<"overview" | "30day" | "60day" | "90day" | "phases" | "quick">("overview");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!projectId || !planId) return;
    try {
      const row = await growthPlansApi.get(projectId, planId);
      setPlanRow(row as unknown as { plan_json: GrowthPlanJson | null; plan_status: string; error_message: string | null });

      if (row.plan_status === "completed" && row.plan_json) {
        // Pre-populate task statuses from plan_json tasks
        const init: Record<string, TaskStatus> = {};
        const plan = row.plan_json as GrowthPlanJson;
        const allTasks = [...(plan.thirty_day_plan ?? []), ...(plan.sixty_day_plan ?? []), ...(plan.ninety_day_plan ?? [])];
        allTasks.forEach(t => { init[t.id] = t.status ?? "not_started"; });
        setTaskStatuses(prev => ({ ...init, ...prev }));
      }
    } catch (err) {
      toast({ title: "Could not load growth plan", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [projectId, planId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!planRow) return;
    if (planRow.plan_status === "queued" || planRow.plan_status === "processing") {
      setPolling(true);
      pollRef.current = setInterval(async () => {
        if (!projectId || !planId) return;
        try {
          const status = await growthPlansApi.getStatus(projectId, planId);
          if (status.plan_status === "completed" || status.plan_status === "failed") {
            clearInterval(pollRef.current!);
            setPolling(false);
            await load();
          }
        } catch { /* ignore */ }
      }, POLL_MS);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [planRow?.plan_status, projectId, planId, load]);

  const handleTaskStatus = async (taskId: string, status: TaskStatus) => {
    setTaskStatuses(prev => ({ ...prev, [taskId]: status }));
    if (!projectId || !planId) return;
    try {
      await growthPlansApi.updateTaskStatus(projectId, planId, taskId, status);
    } catch {
      // silently fail — local state already updated
    }
  };

  const handleCopyPlan = async () => {
    if (!planRow?.plan_json) return;
    const plan = planRow.plan_json as GrowthPlanJson;
    const text = [
      `PERSONAL AUTHORITY GROWTH PLAN — ${plan.project?.name || "Your Practice"}`,
      `Generated: ${new Date(plan.generated_at).toLocaleDateString()}`,
      ``,
      `EXECUTIVE SUMMARY`,
      plan.executive_summary,
      ``,
      `CURRENT AUTHORITY SCORE: ${plan.current_scores?.authority_score}/100`,
      `TARGET AUTHORITY SCORE: ${plan.target_scores?.authority_score}/100`,
      ``,
      `GROWTH STRATEGY`,
      plan.growth_strategy?.headline,
      plan.growth_strategy?.approach,
      ``,
      `30-DAY ACTIONS`,
      ...(plan.thirty_day_plan ?? []).map((t, i) => `${i + 1}. [${t.priority.toUpperCase()}] ${t.title}`),
      ``,
      `60-DAY ACTIONS`,
      ...(plan.sixty_day_plan ?? []).map((t, i) => `${i + 1}. [${t.priority.toUpperCase()}] ${t.title}`),
      ``,
      `90-DAY ACTIONS`,
      ...(plan.ninety_day_plan ?? []).map((t, i) => `${i + 1}. [${t.priority.toUpperCase()}] ${t.title}`),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!planRow) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <p className="text-muted-foreground">Growth plan not found.</p>
          <Link to={`/projects`}><Button variant="outline" className="mt-4">Back to Projects</Button></Link>
        </div>
      </div>
    );
  }

  if (planRow.plan_status === "queued" || planRow.plan_status === "processing") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm px-6">
          <div className="relative mb-6">
            <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
            <TrendingUp className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Building Your Growth Plan</h2>
          <p className="text-muted-foreground text-sm">Analyzing your report findings, generating a personalized roadmap, and writing your action plan...</p>
          <p className="text-xs text-muted-foreground mt-4">This usually takes 30–60 seconds.</p>
        </div>
      </div>
    );
  }

  if (planRow.plan_status === "failed") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-2">Growth Plan Generation Failed</h2>
          <p className="text-muted-foreground text-sm mb-4">{planRow.error_message || "An unexpected error occurred."}</p>
          <Link to={`/projects/${projectId}/reports`}>
            <Button variant="outline">Back to Reports</Button>
          </Link>
        </div>
      </div>
    );
  }

  const plan = planRow.plan_json as GrowthPlanJson;
  if (!plan) return null;

  const allWindowTasks = [
    ...(plan.thirty_day_plan ?? []),
    ...(plan.sixty_day_plan ?? []),
    ...(plan.ninety_day_plan ?? []),
  ];
  const seen = new Set<string>();
  const allUniqueTasks = allWindowTasks.filter(t => {
    if (seen.has(t.id)) return false; seen.add(t.id); return true;
  });
  const completedCount = allUniqueTasks.filter(t => (taskStatuses[t.id] ?? t.status) === "completed").length;
  const totalCount = allUniqueTasks.length;
  const progressPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "30day", label: "30 Days" },
    { id: "60day", label: "60 Days" },
    { id: "90day", label: "90 Days" },
    { id: "quick", label: "Quick Wins" },
    { id: "phases", label: "By Phase" },
  ] as const;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b px-4 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to={`/projects/${projectId}/review`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-base text-foreground truncate flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                Personal Authority Growth Plan
              </h1>
              {plan.project?.name && (
                <p className="text-xs text-muted-foreground truncate">{plan.project.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyPlan} className="hidden sm:flex items-center gap-1.5">
              {copied ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy Plan</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Score + progress hero */}
        <Card className="border-0 shadow-elevated rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-primary/5 via-background to-primary/5 p-6">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <ScoreBadge score={plan.current_scores?.authority_score ?? 0} size="lg" />
                  <span className="text-[10px] text-muted-foreground font-medium">Current</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-600">
                      Target: {plan.target_scores?.authority_score ?? 0}/100
                    </span>
                  </div>
                  <h2 className="font-bold text-lg text-foreground leading-tight mb-1">
                    {plan.growth_strategy?.headline || "Your Personal Growth Roadmap"}
                  </h2>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Plan progress</span>
                      <span>{completedCount}/{totalCount} tasks complete</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-1 pb-1 -mx-4 px-4 no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 text-sm font-medium px-4 py-2 rounded-full transition-colors ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <Card className="border-0 shadow-elevated rounded-xl p-5">
              <h3 className="font-bold text-sm text-foreground mb-2">Executive Summary</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{plan.executive_summary}</p>
            </Card>

            {plan.growth_strategy && (
              <Card className="border-0 shadow-elevated rounded-xl p-5 space-y-3">
                <h3 className="font-bold text-sm text-foreground">Growth Strategy</h3>
                <div className="space-y-2">
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-0.5">Approach</p>
                    <p className="text-sm text-foreground">{plan.growth_strategy.approach}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-0.5">Focus #1</p>
                      <p className="text-sm">{plan.growth_strategy.primary_focus}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-0.5">Focus #2</p>
                      <p className="text-sm">{plan.growth_strategy.secondary_focus}</p>
                    </div>
                  </div>
                  {plan.growth_strategy.revenue_alignment && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-emerald-700 mb-0.5">Revenue Alignment</p>
                      <p className="text-xs text-emerald-700">{plan.growth_strategy.revenue_alignment}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Score targets */}
            <Card className="border-0 shadow-elevated rounded-xl p-5">
              <h3 className="font-bold text-sm text-foreground mb-3">Score Targets</h3>
              <div className="space-y-2">
                {(["foundation", "local_authority", "service_authority", "trust_conversion", "competitive_ai_visibility"] as const).map(k => {
                  const meta = PHASE_META[k];
                  const Icon = meta.icon;
                  const cur = plan.current_scores[k === "competitive_ai_visibility" ? "competitive_ai_score" : `${k}_score` as keyof typeof plan.current_scores] ?? 0;
                  const tgt = plan.target_scores[k === "competitive_ai_visibility" ? "competitive_ai_score" : `${k}_score` as keyof typeof plan.target_scores] ?? 0;
                  return (
                    <div key={k} className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${meta.color} flex-shrink-0`} />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="font-medium text-foreground">{meta.label}</span>
                          <span className="text-muted-foreground">{cur} → <span className="text-emerald-600 font-semibold">{tgt}</span></span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full">
                          <div className="h-full bg-emerald-500/40 rounded-full" style={{ width: `${tgt}%` }}>
                            <div className="h-full bg-primary rounded-full" style={{ width: `${(cur / tgt) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Compliance */}
            {plan.compliance_review_items?.length > 0 && (
              <ComplianceSection items={plan.compliance_review_items} />
            )}

            {/* Missing data */}
            {plan.missing_data?.length > 0 && (
              <Card className="border-0 shadow-elevated rounded-xl p-5">
                <h3 className="font-bold text-sm text-foreground mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500" /> Unlock More Recommendations
                </h3>
                <div className="space-y-1.5">
                  {plan.missing_data.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="text-blue-500 mt-0.5">•</span> {d}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Implementation notes */}
            {plan.implementation_notes?.filter(Boolean).length > 0 && (
              <Card className="border-0 shadow-elevated rounded-xl p-5">
                <h3 className="font-bold text-sm text-foreground mb-2">Implementation Notes</h3>
                <div className="space-y-1.5">
                  {plan.implementation_notes.filter(Boolean).map((n, i) => (
                    <p key={i} className="text-xs text-muted-foreground">• {n}</p>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* 30-day tab */}
        {activeTab === "30day" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0" />
              <h2 className="font-bold text-base text-foreground">30-Day Action Plan</h2>
              <span className="text-xs text-muted-foreground ml-auto">{plan.thirty_day_plan?.length ?? 0} tasks</span>
            </div>
            {(plan.thirty_day_plan ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">No 30-day tasks generated.</p>
            ) : (
              (plan.thirty_day_plan ?? []).map(t => (
                <TaskCard key={t.id} task={{ ...t, status: taskStatuses[t.id] ?? t.status }} onStatusChange={handleTaskStatus} />
              ))
            )}
          </div>
        )}

        {/* 60-day tab */}
        {activeTab === "60day" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500 flex-shrink-0" />
              <h2 className="font-bold text-base text-foreground">60-Day Action Plan</h2>
              <span className="text-xs text-muted-foreground ml-auto">{plan.sixty_day_plan?.length ?? 0} tasks</span>
            </div>
            {(plan.sixty_day_plan ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">No 60-day tasks generated.</p>
            ) : (
              (plan.sixty_day_plan ?? []).map(t => (
                <TaskCard key={t.id} task={{ ...t, status: taskStatuses[t.id] ?? t.status }} onStatusChange={handleTaskStatus} />
              ))
            )}
          </div>
        )}

        {/* 90-day tab */}
        {activeTab === "90day" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0" />
              <h2 className="font-bold text-base text-foreground">90-Day Action Plan</h2>
              <span className="text-xs text-muted-foreground ml-auto">{plan.ninety_day_plan?.length ?? 0} tasks</span>
            </div>
            {(plan.ninety_day_plan ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">No 90-day tasks generated.</p>
            ) : (
              (plan.ninety_day_plan ?? []).map(t => (
                <TaskCard key={t.id} task={{ ...t, status: taskStatuses[t.id] ?? t.status }} onStatusChange={handleTaskStatus} />
              ))
            )}
          </div>
        )}

        {/* Quick wins tab */}
        {activeTab === "quick" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <h2 className="font-bold text-base text-foreground">Quick Wins</h2>
              <span className="text-xs text-muted-foreground ml-auto">{plan.quick_wins?.length ?? 0} tasks</span>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">Easy tasks that can be completed quickly by any team member.</p>
            {(plan.quick_wins ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">No quick wins identified.</p>
            ) : (
              (plan.quick_wins ?? []).map(t => (
                <TaskCard key={t.id} task={{ ...t, status: taskStatuses[t.id] ?? t.status }} onStatusChange={handleTaskStatus} />
              ))
            )}

            {(plan.high_impact_projects ?? []).length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-4 mb-1">
                  <Trophy className="h-4 w-4 text-primary" />
                  <h2 className="font-bold text-base text-foreground">High Impact Projects</h2>
                  <span className="text-xs text-muted-foreground ml-auto">{plan.high_impact_projects?.length ?? 0} tasks</span>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">Bigger efforts with significant authority score impact.</p>
                {(plan.high_impact_projects ?? []).map(t => (
                  <TaskCard key={t.id} task={{ ...t, status: taskStatuses[t.id] ?? t.status }} onStatusChange={handleTaskStatus} />
                ))}
              </>
            )}
          </div>
        )}

        {/* By phase tab */}
        {activeTab === "phases" && (
          <div className="space-y-3">
            {plan.phase_roadmap && Object.entries(plan.phase_roadmap).map(([key, phase]) => (
              <PhaseSection
                key={key}
                phaseKey={key}
                phase={phase}
                taskStatuses={taskStatuses}
                onStatusChange={handleTaskStatus}
              />
            ))}
          </div>
        )}

        {/* Disclaimers */}
        {plan.disclaimers?.length > 0 && (
          <div className="mt-8 space-y-1.5">
            {plan.disclaimers.map((d, i) => (
              <p key={i} className="text-[10px] text-muted-foreground leading-relaxed">• {d}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
