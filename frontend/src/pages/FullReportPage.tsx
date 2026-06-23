import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Loader2, Download, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, Shield, MapPin,
  Zap, Heart, BarChart3, FileText, Info, AlertCircle, TrendingUp, ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { reportsApi, type FullReportJson, type PhaseAnalysis, type PriorityAction, type MissingDataItem } from "@/lib/reportsApi";
import { growthPlansApi } from "@/lib/growthPlansApi";

const POLL_MS = 4000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRiskLevel(score: number) {
  if (score >= 70) return { label: "Low Risk", bgColor: "bg-success/10", textColor: "text-success", Icon: CheckCircle2 };
  if (score >= 50) return { label: "Moderate Risk", bgColor: "bg-yellow-50", textColor: "text-yellow-700", Icon: AlertTriangle };
  if (score >= 30) return { label: "High Risk", bgColor: "bg-orange-50", textColor: "text-orange-700", Icon: AlertTriangle };
  return { label: "Critical Risk", bgColor: "bg-destructive/10", textColor: "text-destructive", Icon: AlertCircle };
}

function getDiagnosis(score: number, businessType: string): string {
  const type = businessType || "practice";
  if (score >= 70) return `${type} has strong online authority and patient acquisition signals.`;
  if (score >= 50) return `${type} has a moderate online presence with meaningful gaps limiting patient growth.`;
  if (score >= 30) return `${type} has significant authority gaps that are actively reducing new patient volume.`;
  return `${type} has critical gaps across visibility, trust, and conversion — patients are choosing competitors.`;
}

function getScoreContext(score: number): string {
  if (score >= 70) return "indicates strong competitive positioning with minor optimization opportunities.";
  if (score >= 50) return "indicates moderate gaps that, if addressed, could significantly increase new patient volume.";
  if (score >= 30) return "indicates serious gaps in how patients find and evaluate your practice online.";
  return "indicates your practice is nearly invisible to patients actively searching for care.";
}

function getPhaseSeverityBg(score: number): string {
  if (score >= 70) return "bg-success/10 text-success";
  if (score >= 50) return "bg-yellow-50 text-yellow-700";
  if (score >= 30) return "bg-orange-50 text-orange-700";
  return "bg-destructive/10 text-destructive";
}

function getPhaseStatus(score: number): string {
  if (score >= 70) return "On Track";
  if (score >= 50) return "Constrained";
  if (score >= 30) return "Significant Gaps";
  return "Critical";
}

// ── Score badge / bar ─────────────────────────────────────────────────────────

function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = score >= 70 ? "text-success border-success" : score >= 45 ? "text-orange-500 border-orange-400" : "text-destructive border-destructive";
  const sz = size === "lg" ? "h-24 w-24 text-[32px]" : size === "sm" ? "h-12 w-12 text-[16px]" : "h-16 w-16 text-[22px]";
  return (
    <div className={`${sz} rounded-full border-4 flex flex-col items-center justify-center flex-shrink-0 ${color} bg-background`}>
      <span className="font-extrabold leading-none">{score}</span>
      <span className="text-[8px] font-semibold text-muted-foreground mt-0.5">/ 100</span>
    </div>
  );
}

function ScoreBar({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  const color = value >= 70 ? "bg-success" : value >= 45 ? "bg-orange-400" : "bg-destructive";
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-[11px] font-semibold text-foreground">{label}</span>
          <span className="text-[11px] font-bold text-foreground">{value}/100</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full">
          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Severity badge ─────────────────────────────────────────────────────────────

const SEV_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-muted text-muted-foreground",
  positive: "bg-success/10 text-success",
};

// ── Phase meta ─────────────────────────────────────────────────────────────────

const PHASE_META: Record<string, { label: string; icon: React.ElementType; color: string; description: string }> = {
  foundation: { label: "Foundation", icon: Shield, color: "text-blue-600", description: "Core technical SEO & site structure" },
  local_authority: { label: "Local Authority", icon: MapPin, color: "text-green-600", description: "Local SEO signals & citations" },
  service_authority: { label: "Service Authority", icon: FileText, color: "text-purple-600", description: "Service-specific expertise signals" },
  trust_conversion: { label: "Trust & Conversion", icon: Heart, color: "text-rose-600", description: "Patient conversion optimization" },
  competitive_ai_visibility: { label: "Competitive & AI", icon: BarChart3, color: "text-orange-600", description: "Competitive positioning & AI visibility" },
};

// ── Phase snapshot card ────────────────────────────────────────────────────────

function PhaseSnapshotCard({
  phaseKey, phase,
}: {
  phaseKey: string; phase: PhaseAnalysis;
}) {
  const meta = PHASE_META[phaseKey] ?? { label: phaseKey, icon: Shield, color: "text-muted-foreground", description: "" };
  const Icon = meta.icon;
  const numColor = phase.score >= 70 ? "text-success" : phase.score >= 50 ? "text-yellow-600" : phase.score >= 30 ? "text-orange-600" : "text-destructive";
  const barColor = phase.score >= 70 ? "bg-success" : phase.score >= 50 ? "bg-yellow-400" : phase.score >= 30 ? "bg-orange-400" : "bg-destructive";

  return (
    <button
      onClick={() => document.getElementById(`phase-${phaseKey}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className="w-full text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
    >
      <Card className="border-0 shadow-elevated rounded-xl h-full transition-shadow group-hover:shadow-lg group-hover:ring-1 group-hover:ring-primary/20">
        <CardContent className="p-5 space-y-3 flex flex-col h-full">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${meta.color}`} />
              </div>
              <div>
                <p className="text-[12px] font-extrabold text-foreground leading-tight">{meta.label}</p>
                <p className="text-[10px] text-muted-foreground">{meta.description}</p>
              </div>
            </div>
            <span className={`text-[20px] font-extrabold leading-none ${numColor}`}>{phase.score}</span>
          </div>

          <div className="h-1.5 bg-muted rounded-full">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${phase.score}%` }} />
          </div>

          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full self-start ${getPhaseSeverityBg(phase.score)}`}>
            {getPhaseStatus(phase.score)}
          </span>

          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">{phase.summary}</p>

          <p className="text-[10px] text-primary font-semibold flex items-center gap-1 group-hover:underline mt-auto pt-1">
            View details <ArrowRight className="h-3 w-3" />
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

// ── Priority action card ───────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  critical: "border-l-destructive",
  high: "border-l-orange-500",
  medium: "border-l-primary",
  low: "border-l-muted-foreground",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Quick win",
  moderate: "Moderate effort",
  advanced: "Long term",
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border border-destructive/20",
  high: "bg-orange-50 text-orange-700 border border-orange-200",
  medium: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  low: "bg-muted text-muted-foreground",
};

function PriorityActionCard({ action, rank }: { action: PriorityAction; rank: number }) {
  return (
    <Card className="border-0 shadow-elevated rounded-xl overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-[13px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
            {rank}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <p className="text-[14px] font-bold text-foreground leading-snug flex-1 min-w-0">{action.title}</p>
              <span className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wide shrink-0 ${PRIORITY_BADGE[action.priority] ?? "bg-muted text-muted-foreground"}`}>
                {action.priority}
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">{action.description}</p>
            {action.why_it_matters && (
              <p className="text-[11px] text-muted-foreground/70 flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                {action.why_it_matters}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 pt-0.5">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground">{DIFFICULTY_LABELS[action.difficulty] ?? action.difficulty}</span>
              </div>
              {action.recommended_owner && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Owner: {action.recommended_owner}</span>
                </div>
              )}
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">{action.phase}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Phase detail section (expandable) ─────────────────────────────────────────

function PhaseSection({ phaseKey, phase }: { phaseKey: string; phase: PhaseAnalysis }) {
  const [open, setOpen] = useState(false);
  const meta = PHASE_META[phaseKey] ?? { label: phaseKey, icon: Shield, color: "text-muted-foreground", description: "" };
  const Icon = meta.icon;

  return (
    <div id={`phase-${phaseKey}`} className="scroll-mt-[72px]">
      <Card className="border-0 shadow-elevated rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/20 transition-colors"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
        >
          <ScoreBadge score={phase.score} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${meta.color}`} />
              <span className="text-[14px] font-extrabold text-foreground">{meta.label}</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">{meta.description}</span>
            </div>
            <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{phase.summary}</p>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>

        {open && (
          <div className="border-t border-border/50 p-5 space-y-5">
            {phase.findings.length > 0 && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground mb-2">Findings</p>
                <div className="space-y-2">
                  {phase.findings.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${SEV_STYLES[f.severity] ?? SEV_STYLES.low}`}>
                        {f.severity.toUpperCase()}
                      </span>
                      <div>
                        <p className="text-[12px] font-semibold text-foreground">{f.label}</p>
                        <p className="text-[11px] text-muted-foreground">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase.priority_fixes.length > 0 && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground mb-2">Priority Fixes</p>
                <div className="space-y-1.5">
                  {phase.priority_fixes.map((fix, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Zap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="text-[12px] text-foreground">{fix}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase.missing_data.length > 0 && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground mb-2">Missing Data</p>
                <div className="flex flex-wrap gap-1.5">
                  {phase.missing_data.map((item, i) => (
                    <span key={i} className="text-[10px] bg-yellow-50 border border-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">{item}</span>
                  ))}
                </div>
              </div>
            )}

            {phase.recommended_next_steps.length > 0 && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground mb-2">Next Steps</p>
                <ol className="space-y-1">
                  {phase.recommended_next_steps.map((step, i) => (
                    <li key={i} className="text-[12px] text-muted-foreground flex items-start gap-2">
                      <span className="text-[10px] font-bold text-primary mt-0.5 shrink-0">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground/60 italic">{phase.estimated_impact}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Missing data item ──────────────────────────────────────────────────────────

function MissingItem({ item }: { item: MissingDataItem }) {
  const reqColors = {
    required: "bg-destructive/10 text-destructive",
    recommended: "bg-yellow-50 text-yellow-700",
    optional: "bg-muted text-muted-foreground",
  };
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
      <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[12px] font-semibold">{item.item_name}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide text-muted-foreground">{item.phase}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${reqColors[item.required_or_optional]}`}>
            {item.required_or_optional}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">{item.why_it_matters}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">How to add: {item.recommended_input_format}</p>
      </div>
    </div>
  );
}

// ── Section heading ────────────────────────────────────────────────────────────

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-[16px] sm:text-[18px] font-extrabold text-foreground">{title}</h2>
      {subtitle && <p className="text-[12px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FullReportPage() {
  const { projectId, reportId } = useParams<{ projectId: string; reportId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [reportStatus, setReportStatus] = useState<string>("queued");
  const [report, setReport] = useState<FullReportJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadReport = useCallback(async () => {
    if (!projectId || !reportId) return;
    try {
      const row = await reportsApi.get(projectId, reportId);
      setReportStatus(row.report_status);
      if (row.report_json) setReport(row.report_json);
      if (row.error_message) setError(row.error_message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId, reportId]);

  useEffect(() => { loadReport(); }, [projectId, reportId]);

  useEffect(() => {
    const inProgress = reportStatus === "queued" || reportStatus === "processing";
    if (inProgress) {
      pollRef.current = setInterval(loadReport, POLL_MS);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [reportStatus, loadReport]);

  const handleGeneratePlan = async () => {
    if (!projectId || !reportId) return;
    setGeneratingPlan(true);
    try {
      const result = await growthPlansApi.start(projectId, reportId);
      navigate(`/projects/${projectId}/growth-plans/${result.plan_id}`);
    } catch (e) {
      toast({ title: "Could not start growth plan", description: (e as Error).message, variant: "destructive" });
      setGeneratingPlan(false);
    }
  };

  const handleExport = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const { exportReportPdf } = await import("@/lib/pdfExport");
      const el = document.getElementById("full-report-printable");
      if (!el) throw new Error("Print element not found");
      const filename = `authority-gap-report-${(report.project.name ?? "export").replace(/\s+/g, "-").toLowerCase()}.pdf`;
      await exportReportPdf(el, filename);
      toast({ title: "Report exported" });
    } catch (e) {
      toast({ title: "Export failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const inProgress = reportStatus === "queued" || reportStatus === "processing";

  // ── LOADING ──
  if (loading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── IN PROGRESS ──
  if (inProgress) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center px-4">
        <Card className="border-0 shadow-elevated rounded-xl max-w-md w-full">
          <CardContent className="py-14 text-center space-y-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <BarChart3 className="h-7 w-7 text-primary animate-pulse" />
            </div>
            <div>
              <h2 className="text-[18px] font-extrabold">Generating Report</h2>
              <p className="text-[13px] text-muted-foreground mt-2">Aggregating all project data, scoring five phases, and generating AI interpretation…</p>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
            <Link to={`/projects/${projectId}/intake`}>
              <Button variant="ghost" size="sm" className="text-[12px]">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to project
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── ERROR ──
  if (error && !report) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center px-4">
        <Card className="border-0 shadow-elevated rounded-xl max-w-md w-full">
          <CardContent className="py-12 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-[14px] font-bold">Report generation failed</p>
            <p className="text-[12px] text-muted-foreground">{error}</p>
            <Link to={`/projects/${projectId}/intake`}>
              <Button size="sm" className="gap-2 mt-2"><ArrowLeft className="h-3.5 w-3.5" /> Back to project</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) return null;

  const { scores, confidence, five_phase_analysis, priority_actions, missing_data } = report;
  const phaseOrder = ["foundation", "local_authority", "service_authority", "trust_conversion", "competitive_ai_visibility"] as const;
  const confidenceColors = { low: "text-destructive", medium: "text-orange-500", high: "text-success" };
  const risk = getRiskLevel(scores.authority_score);
  const RiskIcon = risk.Icon;
  const businessName = report.project.business_name || report.project.name || "This practice";
  const topActions = priority_actions.slice(0, 5);

  return (
    <div className="min-h-screen bg-secondary" id="full-report-printable">

      {/* ── 1. HEADER ─────────────────────────────────────────────────────────── */}
      <header className="bg-card border-b border-border/60 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link to={`/projects/${projectId}/intake`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-[12px] h-8 shrink-0">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
              </Link>
              <div className="h-4 w-px bg-border hidden sm:block shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-primary hidden sm:block">Authority Gap Engine™</p>
                <p className="text-[13px] font-bold text-foreground truncate">{report.project.website_url || businessName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={handleGeneratePlan}
                disabled={generatingPlan || reportStatus !== "completed"}
                className="gap-1.5 font-bold text-[12px] h-8 bg-emerald-600 hover:bg-emerald-700 text-white hidden sm:inline-flex"
              >
                {generatingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                Growth Plan
              </Button>
              <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5 font-bold text-[12px] h-8">
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. HERO DIAGNOSTIC SUMMARY ────────────────────────────────────────── */}
      <section className="bg-card border-b border-border/40">
        <div className="max-w-5xl mx-auto px-4 py-10 sm:py-12">
          <div className="grid lg:grid-cols-[1fr_260px] gap-10 items-start">

            {/* Left: Diagnosis */}
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wide ${risk.bgColor} ${risk.textColor}`}>
                  <RiskIcon className="h-3 w-3" />
                  {risk.label}
                </span>
                <span className="text-[12px] text-muted-foreground font-medium">
                  {report.project.location} · Generated {new Date(report.generated_at).toLocaleDateString()}
                </span>
              </div>

              <h1 className="text-[22px] sm:text-[28px] font-extrabold text-foreground leading-[1.25]">
                {getDiagnosis(scores.authority_score, businessName)}
              </h1>

              <p className="text-[13px] text-muted-foreground/80 leading-relaxed max-w-xl">
                Authority score of{" "}
                <strong className="text-foreground font-bold">{scores.authority_score}/100</strong>{" "}
                {getScoreContext(scores.authority_score)}
              </p>

              {/* Top 3 priority actions as business risks */}
              {topActions.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <p className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-muted-foreground">
                    Top Priority Actions
                  </p>
                  <div className="space-y-2">
                    {topActions.slice(0, 3).map((action, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                          action.priority === "critical" ? "bg-destructive/10 text-destructive"
                          : action.priority === "high" ? "bg-orange-100 text-orange-700"
                          : "bg-yellow-50 text-yellow-700"
                        }`}>
                          {action.priority.toUpperCase()}
                        </span>
                        <p className="text-[13px] font-semibold text-foreground leading-snug">{action.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={handleGeneratePlan}
                  disabled={generatingPlan || reportStatus !== "completed"}
                  className="gap-2 text-[13px] rounded-lg px-7 h-11 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {generatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                  Generate Growth Plan
                </Button>
                <Button
                  variant="outline" size="lg"
                  className="border-border text-foreground gap-2 text-[13px] rounded-lg px-6 h-11 font-bold"
                  onClick={handleExport} disabled={exporting}
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download PDF
                </Button>
              </div>
            </div>

            {/* Right: Score + confidence */}
            <div className="space-y-4 lg:border-l lg:border-border/40 lg:pl-10">
              <div className="flex items-center gap-4">
                <ScoreBadge score={scores.authority_score} size="lg" />
                <div>
                  <p className="text-[11px] font-bold text-foreground">Overall Authority Score</p>
                  <p className={`text-[13px] font-bold mt-1 ${confidenceColors[confidence.level]}`}>
                    {confidence.level} confidence
                  </p>
                  <p className="text-[11px] text-muted-foreground">{confidence.score}% data complete</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <ScoreBar label="Foundation" value={scores.foundation_score} icon={Shield} />
                <ScoreBar label="Local Authority" value={scores.local_authority_score} icon={MapPin} />
                <ScoreBar label="Service Authority" value={scores.service_authority_score} icon={FileText} />
                <ScoreBar label="Trust & Conversion" value={scores.trust_conversion_score} icon={Heart} />
                <ScoreBar label="Competitive & AI" value={scores.competitive_ai_score} icon={BarChart3} />
              </div>

              {/* Data sources */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {confidence.data_sources_available.map(s => (
                  <div key={s} className="flex items-center gap-1 text-[9px] bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">
                    <CheckCircle2 className="h-2.5 w-2.5" /> {s}
                  </div>
                ))}
                {confidence.data_sources_missing.slice(0, 2).map(s => (
                  <div key={s} className="flex items-center gap-1 text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    <AlertCircle className="h-2.5 w-2.5" /> {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-7 sm:py-8 space-y-8 sm:space-y-10">

        {/* ── EXECUTIVE SUMMARY ──────────────────────────────────────────────── */}
        {report.executive_summary && (
          <section>
            <Card className="border-0 shadow-elevated rounded-xl">
              <CardContent className="p-5 sm:p-6">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground mb-3">Executive Summary</p>
                <p className="text-[14px] text-foreground leading-relaxed">{report.executive_summary}</p>
                {report.opportunity_summary.estimated_revenue_low > 0 && (
                  <div className="mt-4 p-4 rounded-xl bg-success/5 border border-success/20">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-success mb-1">Revenue Opportunity</p>
                    <p className="text-[13px] text-foreground">{report.opportunity_summary.summary}</p>
                    <p className="text-[12px] text-muted-foreground mt-1.5">
                      Estimated: ${report.opportunity_summary.estimated_revenue_low.toLocaleString()} – ${report.opportunity_summary.estimated_revenue_high.toLocaleString()} / mo
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── 3. EXECUTIVE SNAPSHOT ───────────────────────────────────────────── */}
        <section>
          <SectionHeading
            title="Diagnostic Overview"
            subtitle="Performance across all five authority phases — click any card to jump to the full section"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {phaseOrder.map(key => (
              <PhaseSnapshotCard
                key={key}
                phaseKey={key}
                phase={five_phase_analysis[key]}
              />
            ))}
          </div>
        </section>

        {/* ── 4. PRIORITY FIXES ───────────────────────────────────────────────── */}
        {topActions.length > 0 && (
          <section>
            <SectionHeading
              title="Priority Fixes"
              subtitle="The highest-impact actions ranked by priority — address these first for the greatest return"
            />
            <div className="space-y-3 mt-4">
              {topActions.map((action, i) => (
                <PriorityActionCard key={i} action={action} rank={i + 1} />
              ))}
            </div>
          </section>
        )}

        {/* ── 5. DETAILED DIAGNOSTIC SECTIONS ─────────────────────────────────── */}
        <section>
          <SectionHeading
            title="Full Phase Analysis"
            subtitle="Detailed findings for each authority dimension — expand to view findings, fixes, and next steps"
          />
          <div className="space-y-3 mt-4">
            {phaseOrder.map(key => (
              <PhaseSection
                key={key}
                phaseKey={key}
                phase={five_phase_analysis[key]}
              />
            ))}
          </div>
        </section>

        {/* Missing Data */}
        {missing_data.length > 0 && (
          <section>
            <button
              onClick={() => setShowMissing(v => !v)}
              className="flex items-center gap-2.5 w-full text-left mb-3"
            >
              <div className="h-1.5 w-5 bg-muted-foreground/30 rounded-full" />
              <span className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-muted-foreground flex-1">
                Missing Data ({missing_data.length} items)
              </span>
              {showMissing ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showMissing && (
              <div className="space-y-2">
                {missing_data.map((item, i) => <MissingItem key={i} item={item} />)}
              </div>
            )}
          </section>
        )}

        {/* Methodology */}
        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="p-5 space-y-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Methodology</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{report.methodology}</p>
            {report.disclaimers.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground mb-2">Disclaimers</p>
                <ul className="space-y-1">
                  {report.disclaimers.map((d, i) => (
                    <li key={i} className="text-[10px] text-muted-foreground/60">· {d}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 6. FINAL ACTION PLAN ────────────────────────────────────────────── */}
        <Card className="shadow-elevated border-0 rounded-xl border-t-4 border-t-emerald-600 overflow-hidden">
          <CardContent className="py-10 sm:py-12 text-center space-y-6 px-5 sm:px-8">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-[18px] sm:text-[20px] font-extrabold text-foreground leading-tight">
                Turn This Report Into a Growth Plan
              </h3>
              <p className="text-[13px] text-muted-foreground/70 max-w-lg mx-auto leading-[1.7]">
                Generate a prioritized, actionable growth plan based on these diagnostic findings — with step-by-step tasks assigned by phase.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 text-left max-w-2xl mx-auto">
              {[
                "Review priority fixes and phase findings above",
                "Generate your personalized growth plan",
                "Track progress and re-scan monthly to measure improvement",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                  <span className="h-6 w-6 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-[12px] font-medium text-foreground leading-snug">{step}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <Button
                size="lg"
                onClick={handleGeneratePlan}
                disabled={generatingPlan || reportStatus !== "completed"}
                className="gap-2 text-[13px] rounded-lg px-6 h-12 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {generatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                {generatingPlan ? "Generating…" : "Generate Growth Plan"}
              </Button>
              <Button
                variant="outline" size="lg"
                className="gap-2 text-[13px] rounded-lg px-6 h-12 font-bold"
                onClick={handleExport} disabled={exporting}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting ? "Exporting…" : "Download PDF"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
