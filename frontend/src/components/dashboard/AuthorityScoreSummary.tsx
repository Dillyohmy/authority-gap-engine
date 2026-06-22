import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus, RefreshCw, FileText, BarChart3, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { DashboardViewModel } from "@/lib/dashboardApi";

interface Props {
  data: DashboardViewModel;
  projectId: string;
  onGenerateReport?: () => void;
  onGenerateGrowthPlan?: () => void;
  onRescan?: () => void;
  generatingReport?: boolean;
  generatingPlan?: boolean;
}

function ScoreCell({ label, value, provisional }: { label: string; value: number | null; provisional?: boolean }) {
  const color =
    value === null ? "text-muted-foreground" :
    value >= 80 ? "text-emerald-600" :
    value >= 65 ? "text-blue-600" :
    value >= 45 ? "text-amber-600" : "text-red-600";

  return (
    <div className="text-center">
      <div className={`text-2xl font-bold tabular-nums ${color}`}>
        {value !== null ? value : "—"}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5 leading-tight">
        {label}
        {provisional && value !== null && (
          <span className="ml-1 text-amber-500">~</span>
        )}
      </div>
    </div>
  );
}

function scoreIcon(score: number | null) {
  if (score === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (score >= 65) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (score >= 45) return <Minus className="h-4 w-4 text-amber-500" />;
  return <TrendingDown className="h-4 w-4 text-red-500" />;
}

function statusBadge(state: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    no_data: { label: "Not Started", variant: "secondary" },
    intake_incomplete: { label: "Intake Incomplete", variant: "outline" },
    intake_complete: { label: "Ready to Scan", variant: "outline" },
    scan_complete: { label: "Scan Complete", variant: "secondary" },
    report_complete: { label: "Report Ready", variant: "default" },
    growth_plan_active: { label: "Growth Plan Active", variant: "default" },
    all_complete: { label: "All Complete", variant: "default" },
  };
  const cfg = map[state] ?? { label: state, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function AuthorityScoreSummary({ data, projectId, onGenerateReport, onGenerateGrowthPlan, onRescan, generatingReport, generatingPlan }: Props) {
  const navigate = useNavigate();
  const { scores, biggest_gap, latest_scan, latest_report, latest_growth_plan, dashboard_state, intake_progress } = data;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-semibold text-lg leading-tight">
              {data.project.business_name || data.project.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {data.project.website_url || "No website URL set"} · {data.project.location || "No location set"}
            </p>
          </div>
          {statusBadge(dashboard_state)}
        </div>
        <div className="flex items-center gap-2">
          {onRescan && (
            <Button size="sm" variant="outline" onClick={onRescan}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Rescan
            </Button>
          )}
          {!latest_report && onGenerateReport && (
            <Button size="sm" onClick={onGenerateReport} disabled={generatingReport}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {generatingReport ? "Generating…" : "Generate Report"}
            </Button>
          )}
          {latest_report && !latest_growth_plan && onGenerateGrowthPlan && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onGenerateGrowthPlan} disabled={generatingPlan}>
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              {generatingPlan ? "Generating…" : "Generate Growth Plan"}
            </Button>
          )}
          {latest_report && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/projects/${projectId}/reports/${latest_report.id}`)}>
              View Report
            </Button>
          )}
          {latest_growth_plan && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/projects/${projectId}/growth-plans/${latest_growth_plan.id}`)}>
              View Growth Plan
            </Button>
          )}
        </div>
      </div>

      {/* Score grid */}
      <div className="grid grid-cols-4 sm:grid-cols-7 divide-x px-0 py-0">
        <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center py-5 px-4 bg-muted/10">
          <div className={`text-4xl font-black tabular-nums ${
            scores.authority === null ? "text-muted-foreground" :
            scores.authority >= 80 ? "text-emerald-600" :
            scores.authority >= 65 ? "text-blue-600" :
            scores.authority >= 45 ? "text-amber-600" : "text-red-600"
          }`}>
            {scores.authority !== null ? scores.authority : "—"}
          </div>
          <div className="text-xs font-medium text-muted-foreground mt-1">Authority Score</div>
          {scores.provisional && scores.authority !== null && (
            <span className="text-[10px] text-amber-500 mt-0.5">provisional</span>
          )}
        </div>
        <div className="py-5 px-3 flex flex-col items-center justify-center">
          <ScoreCell label="Audit Readiness" value={scores.audit_readiness} provisional={scores.provisional} />
        </div>
        <div className="py-5 px-3 flex flex-col items-center justify-center">
          <ScoreCell label="Foundation" value={scores.foundation} provisional={scores.provisional} />
        </div>
        <div className="py-5 px-3 flex flex-col items-center justify-center">
          <ScoreCell label="Local Authority" value={scores.local_authority} provisional={scores.provisional} />
        </div>
        <div className="py-5 px-3 flex flex-col items-center justify-center">
          <ScoreCell label="Service Authority" value={scores.service_authority} provisional={scores.provisional} />
        </div>
        <div className="py-5 px-3 flex flex-col items-center justify-center">
          <ScoreCell label="Trust & Conversion" value={scores.trust_conversion} provisional={scores.provisional} />
        </div>
        <div className="py-5 px-3 flex flex-col items-center justify-center">
          <ScoreCell label="Competitive & AI" value={scores.competitive_ai_visibility} provisional={scores.provisional} />
        </div>
      </div>

      {/* Bottom row — gap, dates, progress */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-3 border-t bg-muted/10 text-xs text-muted-foreground">
        {biggest_gap && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>Biggest gap: <strong className="text-foreground">{biggest_gap.label}</strong> ({biggest_gap.score}/100)</span>
          </div>
        )}
        {latest_scan && (
          <div className="flex items-center gap-1">
            {scoreIcon(latest_scan.authority_gap_score)}
            <span>Last scan: {formatDate(latest_scan.created_at)}</span>
          </div>
        )}
        {latest_report && (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Report: {formatDate(latest_report.created_at)}</span>
          </div>
        )}
        {latest_growth_plan && (
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
            <span>Growth plan: {formatDate(latest_growth_plan.created_at)}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span>Intake {intake_progress.pct}%</span>
          <Progress value={intake_progress.pct} className="w-20 h-1.5" />
        </div>
      </div>
    </div>
  );
}
