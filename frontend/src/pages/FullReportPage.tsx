import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, RefreshCw, Loader2, Download, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, Shield, MapPin,
  Zap, Heart, BarChart3, FileText, Info, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { reportsApi, type FullReportJson, type PhaseAnalysis, type PriorityAction, type MissingDataItem } from "@/lib/reportsApi";

const POLL_MS = 4000;

// ── Score ring / badge ─────────────────────────────────────────────────────────

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

// ── Phase section ──────────────────────────────────────────────────────────────

const PHASE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  foundation: { label: "Foundation", icon: Shield, color: "text-blue-600" },
  local_authority: { label: "Local Authority", icon: MapPin, color: "text-green-600" },
  service_authority: { label: "Service Authority", icon: FileText, color: "text-purple-600" },
  trust_conversion: { label: "Trust & Conversion", icon: Heart, color: "text-rose-600" },
  competitive_ai_visibility: { label: "Competitive & AI Visibility", icon: BarChart3, color: "text-orange-600" },
};

function PhaseSection({ phaseKey, phase }: { phaseKey: string; phase: PhaseAnalysis }) {
  const [open, setOpen] = useState(false);
  const meta = PHASE_META[phaseKey] ?? { label: phaseKey, icon: Shield, color: "text-muted-foreground" };
  const Icon = meta.icon;

  return (
    <Card className="border-0 shadow-elevated rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <ScoreBadge score={phase.score} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${meta.color}`} />
            <span className="text-[14px] font-extrabold text-foreground">{meta.label}</span>
          </div>
          <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{phase.summary}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border/50 p-5 space-y-5">
          {/* Findings */}
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

          {/* Priority fixes */}
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

          {/* Missing data */}
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

          {/* Recommended next steps */}
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
  );
}

// ── Priority action card ───────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  critical: "border-l-destructive",
  high: "border-l-orange-500",
  medium: "border-l-primary",
  low: "border-l-muted-foreground",
};

const DIFFICULTY_LABELS = { easy: "Easy win", moderate: "Moderate effort", advanced: "Long term" };

function ActionCard({ action, rank }: { action: PriorityAction; rank: number }) {
  return (
    <div className={`border-l-4 rounded-r-xl p-4 bg-muted/20 ${ACTION_COLORS[action.priority] ?? "border-l-muted"}`}>
      <div className="flex items-start gap-3">
        <span className="text-[11px] font-extrabold text-muted-foreground mt-0.5 w-5 shrink-0">{rank}.</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[13px] font-bold text-foreground">{action.title}</span>
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{action.phase}</span>
            <span className="text-[10px] text-muted-foreground capitalize">{action.priority}</span>
          </div>
          <p className="text-[12px] text-muted-foreground">{action.description}</p>
          {action.why_it_matters && (
            <p className="text-[11px] text-muted-foreground/60 mt-1 flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" /> {action.why_it_matters}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right text-[10px] text-muted-foreground">
          <p>{DIFFICULTY_LABELS[action.difficulty] ?? action.difficulty}</p>
          <p className="mt-0.5">{action.recommended_owner}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FullReportPage() {
  const { projectId, reportId } = useParams<{ projectId: string; reportId: string }>();
  const { toast } = useToast();

  const [reportStatus, setReportStatus] = useState<string>("queued");
  const [report, setReport] = useState<FullReportJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
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

  return (
    <div className="min-h-screen bg-secondary" id="full-report-printable">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link to={`/projects/${projectId}/intake`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-[12px]">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-primary">Authority Gap Engine™</p>
              <h1 className="text-[24px] font-extrabold text-foreground leading-tight mt-0.5">Full Authority Gap Report</h1>
              <p className="text-[12px] text-muted-foreground mt-1">
                {report.project.business_name || report.project.name} · {report.project.location} · Generated {new Date(report.generated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5 font-bold text-[12px] shrink-0 h-9">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export PDF
          </Button>
        </div>

        {/* Authority Score + Confidence */}
        <Card className="border-0 shadow-elevated rounded-xl overflow-hidden">
          <div className="bg-ihd-dark-green px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-semibold">Overall Authority Score</p>
              <p className="text-[48px] font-extrabold text-white leading-none mt-1">{scores.authority_score}</p>
              <p className="text-[11px] text-white/60 mt-1">out of 100</p>
            </div>
            <div className="text-right">
              <p className={`text-[13px] font-bold uppercase ${confidenceColors[confidence.level]}`}>
                {confidence.level} confidence
              </p>
              <p className="text-[11px] text-white/50 mt-1">{confidence.score}% data completeness</p>
              <p className="text-[11px] text-white/50 mt-0.5">{confidence.data_sources_available.length} sources available</p>
            </div>
          </div>
          <CardContent className="p-5 space-y-3">
            <ScoreBar label="Foundation" value={scores.foundation_score} icon={Shield} />
            <ScoreBar label="Local Authority" value={scores.local_authority_score} icon={MapPin} />
            <ScoreBar label="Service Authority" value={scores.service_authority_score} icon={FileText} />
            <ScoreBar label="Trust & Conversion" value={scores.trust_conversion_score} icon={Heart} />
            <ScoreBar label="Competitive & AI Visibility" value={scores.competitive_ai_score} icon={BarChart3} />
          </CardContent>
        </Card>

        {/* Executive Summary */}
        <Card className="border-0 shadow-elevated rounded-xl">
          <CardContent className="p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground mb-3">Executive Summary</p>
            <p className="text-[14px] text-foreground leading-relaxed">{report.executive_summary}</p>
            {report.opportunity_summary.estimated_revenue_low > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-success/5 border border-success/20">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-success mb-1">Revenue Opportunity</p>
                <p className="text-[13px] text-foreground">{report.opportunity_summary.summary}</p>
                <p className="text-[12px] text-muted-foreground mt-1.5">
                  Estimated range: ${report.opportunity_summary.estimated_revenue_low.toLocaleString()} – ${report.opportunity_summary.estimated_revenue_high.toLocaleString()} / mo
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data sources */}
        <div className="flex flex-wrap gap-2">
          {confidence.data_sources_available.map(s => (
            <div key={s} className="flex items-center gap-1 text-[10px] bg-success/10 text-success px-2.5 py-1 rounded-full font-medium">
              <CheckCircle2 className="h-3 w-3" /> {s}
            </div>
          ))}
          {confidence.data_sources_missing.slice(0, 3).map(s => (
            <div key={s} className="flex items-center gap-1 text-[10px] bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
              <AlertCircle className="h-3 w-3" /> {s} missing
            </div>
          ))}
        </div>

        {/* Five Phase Analysis */}
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-1.5 w-5 bg-ihd-dark-green rounded-full" />
            <span className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-foreground">Five Phase Analysis</span>
          </div>
          <div className="space-y-3">
            {phaseOrder.map(key => (
              <PhaseSection key={key} phaseKey={key} phase={five_phase_analysis[key]} />
            ))}
          </div>
        </div>

        {/* Priority Action Plan */}
        {priority_actions.length > 0 && (
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-1.5 w-5 bg-ihd-dark-green rounded-full" />
              <span className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-foreground">Priority Action Plan</span>
            </div>
            <div className="space-y-3">
              {priority_actions.map((action, i) => (
                <ActionCard key={i} action={action} rank={i + 1} />
              ))}
            </div>
          </div>
        )}

        {/* Missing Data */}
        {missing_data.length > 0 && (
          <div>
            <button
              onClick={() => setShowMissing(v => !v)}
              className="flex items-center gap-2.5 mb-3 w-full text-left"
            >
              <div className="h-1.5 w-5 bg-muted-foreground/30 rounded-full" />
              <span className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-muted-foreground flex-1">
                Missing Data ({missing_data.length} items)
              </span>
              {showMissing ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {showMissing && (
              <div className="space-y-2">
                {missing_data.map((item, i) => (
                  <MissingItem key={i} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Methodology + Disclaimers */}
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
      </div>
    </div>
  );
}

function MissingItem({ item }: { item: MissingDataItem }) {
  const reqColors = { required: "bg-destructive/10 text-destructive", recommended: "bg-yellow-50 text-yellow-700", optional: "bg-muted text-muted-foreground" };
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
      <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[12px] font-semibold">{item.item_name}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">{item.phase}</span>
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
