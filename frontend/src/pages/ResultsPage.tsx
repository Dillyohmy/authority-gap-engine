import { useRef, useState, useCallback, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, BarChart3, TrendingUp, ArrowRight, Lock, Save, MousePointerClick,
  Download, Loader2, CheckCircle2, ChevronDown, ChevronUp,
  AlertTriangle, AlertCircle, Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/tracking";
import { getScanResult } from "@/lib/scanClient";
import ScoreRing from "@/components/ScoreRing";
import IntelligenceBlock from "@/components/IntelligenceBlock";
import ResultsTeaser from "@/components/ResultsTeaser";
import LeadCaptureForm, { type LeadData } from "@/components/LeadCaptureForm";
import ScanError from "@/components/ScanError";
import { exportReportPdf } from "@/lib/pdfExport";
import type { ScanReport, ScanFinding } from "@/types/scanReport";
import { IS_MOCK_MODE } from "@/lib/mockScanData";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FlaskConical } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRiskLevel(score: number) {
  if (score >= 70) return { label: "Low Risk", bgColor: "bg-success/10", textColor: "text-success", Icon: CheckCircle2 };
  if (score >= 50) return { label: "Moderate Risk", bgColor: "bg-yellow-50", textColor: "text-yellow-700", Icon: AlertTriangle };
  if (score >= 30) return { label: "High Risk", bgColor: "bg-orange-50", textColor: "text-orange-700", Icon: AlertTriangle };
  return { label: "Critical Risk", bgColor: "bg-destructive/10", textColor: "text-destructive", Icon: AlertCircle };
}

function getDiagnosis(score: number, clinicType: string): string {
  const type = clinicType || "healthcare";
  if (score >= 70) return `Your ${type} practice has strong online authority and patient acquisition signals.`;
  if (score >= 50) return `Your ${type} practice has a moderate online presence with meaningful gaps limiting patient growth.`;
  if (score >= 30) return `Your ${type} practice has significant authority gaps that are actively reducing new patient volume.`;
  return `Your ${type} practice has critical gaps across visibility, trust, and conversion — patients are choosing competitors instead.`;
}

function getScoreContext(score: number): string {
  if (score >= 70) return "indicates strong competitive positioning with minor optimization opportunities.";
  if (score >= 50) return "indicates moderate visibility and conversion gaps that, if addressed, could significantly increase new patient volume.";
  if (score >= 30) return "indicates serious gaps in how patients find and evaluate your practice online.";
  return "indicates your practice is nearly invisible to patients actively searching for care. Immediate action is required.";
}

function getSeverityBg(pct: number): string {
  if (pct >= 0.7) return "bg-success/10 text-success";
  if (pct >= 0.5) return "bg-yellow-50 text-yellow-700";
  if (pct >= 0.3) return "bg-orange-50 text-orange-700";
  return "bg-destructive/10 text-destructive";
}

/** Derive status label from score ratio */
function getStatusLabel(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.7) return "Performing Within Range";
  if (pct >= 0.5) return "Constrained Performance";
  if (pct >= 0.3) return "Significant Gaps";
  return "Severe Weakness";
}

const RISK_BADGE: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-orange-100 text-orange-700",
  low: "bg-yellow-50 text-yellow-700",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-[16px] sm:text-[18px] font-extrabold text-foreground">{title}</h2>
      {subtitle && <p className="text-[12px] text-muted-foreground leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function SnapshotCard({
  title, subtitle, score, max, icon, summary, status, onClick, highlight,
}: {
  title: string; subtitle: string; score: number; max: number;
  icon: React.ReactNode; summary: string; status: string;
  onClick: () => void; highlight?: string;
}) {
  const pct = score / max;
  const pctInt = Math.round(pct * 100);
  const numColor = pct >= 0.7 ? "text-success" : pct >= 0.5 ? "text-yellow-600" : pct >= 0.3 ? "text-orange-600" : "text-destructive";
  const barColor = pct >= 0.7 ? "bg-success" : pct >= 0.5 ? "bg-yellow-400" : pct >= 0.3 ? "bg-orange-400" : "bg-destructive";

  return (
    <button onClick={onClick} className="w-full text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
      <Card className="border-0 shadow-elevated rounded-xl h-full transition-shadow group-hover:shadow-lg group-hover:ring-1 group-hover:ring-primary/20">
        <CardContent className="p-5 space-y-3.5 flex flex-col h-full">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                {icon}
              </div>
              <div>
                <p className="text-[12px] font-extrabold text-foreground leading-tight">{title}</p>
                <p className="text-[10px] text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <span className={`text-[22px] font-extrabold leading-none ${numColor}`}>
              {pctInt}<span className="text-[11px] font-bold text-muted-foreground">%</span>
            </span>
          </div>

          <div className="h-1.5 bg-muted rounded-full">
            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pctInt}%` }} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getSeverityBg(pct)}`}>{status}</span>
            {highlight && <span className="text-[10px] font-bold text-success">{highlight}</span>}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">{summary}</p>

          <p className="text-[10px] text-primary font-semibold flex items-center gap-1 group-hover:underline mt-auto pt-1">
            View full analysis <ArrowRight className="h-3 w-3" />
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

function PriorityFixCard({ fix, rank }: { fix: ScanFinding; rank: number }) {
  const EFFORT: Record<string, string> = { high: "Significant effort required", medium: "Moderate effort", low: "Quick win" };
  const BADGE: Record<string, string> = {
    high: "bg-destructive/10 text-destructive border border-destructive/20",
    medium: "bg-orange-50 text-orange-700 border border-orange-200",
    low: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  };

  return (
    <Card className="border-0 shadow-elevated rounded-xl overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-[13px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
            {rank}
          </div>
          <div className="flex-1 space-y-2.5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <p className="text-[14px] font-bold text-foreground leading-snug flex-1 min-w-0">{fix.label}</p>
              <span className={`text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wide shrink-0 ${BADGE[fix.severity] ?? "bg-muted text-muted-foreground"}`}>
                {fix.severity} priority
              </span>
            </div>
            {fix.description && (
              <p className="text-[12px] text-muted-foreground leading-relaxed">{fix.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 pt-0.5">
              {fix.impact && (
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-[11px] text-muted-foreground">{fix.impact}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground">{EFFORT[fix.severity]}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DiagnosticSection({
  title, subtitle, icon, score, max, status, summary, children, sectionRef,
}: {
  title: string; subtitle: string; icon: React.ReactNode;
  score: number; max: number; status: string; summary: string;
  children: React.ReactNode;
  sectionRef?: React.RefObject<HTMLDivElement>;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = score / max;
  const numColor = pct >= 0.7 ? "text-success" : pct >= 0.5 ? "text-yellow-600" : pct >= 0.3 ? "text-orange-600" : "text-destructive";

  return (
    <div ref={sectionRef} className="scroll-mt-[72px]">
      <Card className="border-0 shadow-elevated rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/20 transition-colors"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-extrabold text-foreground">{title}</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">{subtitle}</span>
            </div>
            <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">{summary}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <span className={`text-[20px] font-extrabold leading-none ${numColor}`}>{Math.round(pct * 100)}%</span>
              <p className="text-[9px] text-muted-foreground font-medium mt-0.5 whitespace-nowrap">{status}</p>
            </div>
            {expanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </div>
        </button>
        {expanded && (
          <div className="border-t border-border/40">
            {children}
          </div>
        )}
      </Card>
    </div>
  );
}

/** Preview Mode badge — shown only in mock mode */
function PreviewBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-foreground/15 text-primary-foreground text-[10px] font-bold uppercase tracking-wide cursor-default shrink-0">
            <FlaskConical className="h-3 w-3" />
            Preview Mode
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[12px] max-w-[220px]">
          Using demo data. Live analysis will run when backend is connected.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const ResultsPage = () => {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const visibilityRef = useRef<HTMLDivElement>(null);
  const conversionRef = useRef<HTMLDivElement>(null);
  const opportunityRef = useRef<HTMLDivElement>(null);

  const jobId = params.get("jobId") || "";
  const scanId = params.get("scanId") || "";

  const [report, setReport] = useState<ScanReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  // Fetch report — from backend by jobId, or from Supabase by scanId (dashboard revisit)
  useEffect(() => {
    let cancelled = false;

    const fetchReport = async () => {
      // Path 1: revisit from dashboard — load report_json directly from Supabase
      if (scanId && !jobId) {
        try {
          const { data, error } = await supabase
            .from("scans")
            .select("report_json, job_id, website_url")
            .eq("id", scanId)
            .single();

          if (cancelled) return;

          if (error || !data) {
            setFetchError("Report not found.");
            setLoading(false);
            return;
          }

          if (data.report_json) {
            setReport(data.report_json as ScanReport);
            setUnlocked(true);
            setLoading(false);
            return;
          }

          // report_json not stored — try fetching live result by job_id
          if (data.job_id) {
            try {
              const result = await getScanResult(data.job_id);
              if (!cancelled) {
                setReport(result);
                setUnlocked(true);
                setLoading(false);
                supabase.from("scans").update({ report_json: result }).eq("id", scanId).then(() => {});
              }
              return;
            } catch {
              // job expired from Redis — fall through to rescan prompt
            }
          }

          const websiteUrl = data.website_url;
          setFetchError(
            websiteUrl
              ? `__RESCAN__${websiteUrl}`
              : "Report data not available. Please run a new scan."
          );
          setLoading(false);
        } catch (err) {
          if (!cancelled) {
            setFetchError(err instanceof Error ? err.message : "Could not load report.");
            setLoading(false);
          }
        }
        return;
      }

      // Path 2: normal flow — load from backend by jobId
      if (!jobId) {
        setFetchError("No scan job found. Please start a new scan.");
        setLoading(false);
        return;
      }

      try {
        const data = await getScanResult(jobId);
        if (!cancelled) { setReport(data); setLoading(false); }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Could not load report data.");
          setLoading(false);
        }
      }
    };

    fetchReport();
    return () => { cancelled = true; };
  }, [jobId, scanId]);

  // Auto-save scan to Supabase when report loads and user is logged in
  useEffect(() => {
    if (!report || !user) return;
    supabase.from("scans").insert([{
      user_id: user.id,
      website_url: report.input.website_url,
      clinic_type: report.input.clinic_type,
      location: report.input.location,
      authority_gap_score: report.scores.authority_gap_score,
      visibility_score: report.scores.visibility_score,
      conversion_score: report.scores.conversion_score,
      opportunity_score: report.scores.opportunity_score,
      estimated_revenue_low: report.estimated_revenue_low,
      estimated_revenue_high: report.estimated_revenue_high,
      report_json: report,
      findings_json: {
        visibility: report.visibility.findings,
        conversion: report.conversion.findings,
        topFixes: report.top_fixes,
      },
    }]).then(({ error }) => {
      if (error) console.warn("Could not auto-save scan:", error.message);
    });
  }, [report, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (report && !unlocked) trackEvent("teaser_viewed", report.input.website_url);
  }, [report]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (!unlocked && report) trackEvent("abandoned", report.input.website_url);
    };
  }, [unlocked, report]);

  const handleLeadSubmit = async (data: LeadData) => {
    if (!report) return;
    setLeadSubmitting(true);
    try {
      const { IS_MOCK_MODE } = await import("@/lib/mockScanData");
      if (!IS_MOCK_MODE) {
        const { submitLead } = await import("@/lib/scanClient");
        await submitLead({
          name: data.name?.trim(),
          email: data.email.trim(),
          wants_strategy_review: data.wantsStrategyReview,
          email_opt_in: true,
          website_url: report.input.website_url,
          clinic_type: report.input.clinic_type,
          location: report.input.location,
          authority_gap_score: report.scores.authority_gap_score,
          estimated_revenue_low: report.estimated_revenue_low,
          estimated_revenue_high: report.estimated_revenue_high,
        });
      } else {
        const { error } = await supabase.from("leads").insert([{
          name: data.name?.trim() || null,
          email: data.email.trim(),
          wants_strategy_review: data.wantsStrategyReview,
          website_url: report.input.website_url,
          clinic_type: report.input.clinic_type,
          location: report.input.location,
        }]);
        if (error) throw error;
      }

      trackEvent("lead_submitted", report.input.website_url, { email: data.email, strategy: data.wantsStrategyReview ? "yes" : "no" });
      setUnlocked(true);
      toast({ title: "Report unlocked", description: `Welcome${data.name ? `, ${data.name}` : ""}! Your full diagnostic is ready.` });
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLeadSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!report) return;
    if (!user) { navigate("/auth"); return; }
    const { error } = await supabase.from("scans").insert([{
      user_id: user.id,
      website_url: report.input.website_url,
      clinic_type: report.input.clinic_type,
      location: report.input.location,
      authority_gap_score: report.scores.authority_gap_score,
      visibility_score: report.scores.visibility_score,
      conversion_score: report.scores.conversion_score,
      opportunity_score: report.scores.opportunity_score,
      estimated_revenue_low: report.estimated_revenue_low,
      estimated_revenue_high: report.estimated_revenue_high,
      findings_json: JSON.parse(JSON.stringify({
        visibility: report.visibility.findings,
        conversion: report.conversion.findings,
        topFixes: report.top_fixes,
      })),
    }]);
    if (error) {
      toast({ title: "Error saving scan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Scan saved", description: "View it anytime from your dashboard." });
    }
  };

  const handleExportPdf = useCallback(async () => {
    if (!reportRef.current || exporting || !report) return;
    setExporting(true);
    trackEvent("pdf_exported", report.input.website_url);
    try {
      await exportReportPdf(reportRef.current, `authority-gap-report-${report.input.website_url}.pdf`);
      toast({ title: "PDF exported", description: "Your report has been downloaded." });
    } catch {
      toast({ title: "Export failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [exporting, report, toast]);

  // ── LOADING ──
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-secondary">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <p className="text-[13px] text-muted-foreground font-medium">Loading report data…</p>
        </div>
      </div>
    );
  }

  // ── ERROR ──
  if (fetchError || !report) {
    const rescanUrl = fetchError?.startsWith("__RESCAN__") ? fetchError.replace("__RESCAN__", "") : null;
    return (
      <ScanError
        message={
          rescanUrl
            ? `This report was saved before full report storage was enabled. Re-run the scan to generate a fresh report.`
            : (fetchError || "Report data is missing or incomplete.")
        }
        onRetry={() => rescanUrl
          ? navigate(`/scan?url=${encodeURIComponent(rescanUrl)}`)
          : navigate("/scan")
        }
        retryLabel={rescanUrl ? "Re-run Scan" : undefined}
      />
    );
  }

  const { input, scores, visibility, conversion, opportunity, top_fixes, estimated_revenue_low, estimated_revenue_high, executive_summary, methodology } = report;

  // ── GATED VIEW: Teaser + Lead Form ──
  if (!unlocked) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-secondary">
        <div className="bg-ihd-nav text-primary-foreground">
          <div className="container max-w-5xl py-4 px-4">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 font-semibold mb-1">Authority Gap Report</p>
                <h1 className="text-[18px] sm:text-[22px] font-extrabold leading-tight">{input.website_url}</h1>
                <p className="text-[11px] opacity-50 mt-0.5 font-medium">{input.clinic_type} · {input.location}</p>
              </div>
              {IS_MOCK_MODE && <PreviewBadge />}
            </motion.div>
          </div>
        </div>

        <div className="container max-w-5xl px-4 py-6 sm:py-8 space-y-8">
          <ResultsTeaser report={report} />
          <div className="relative overflow-hidden rounded-xl">
            <div className="blur-[6px] opacity-40 pointer-events-none select-none space-y-4 px-4 py-6">
              <Card className="border-0 rounded-xl"><CardContent className="p-5 h-20" /></Card>
              <Card className="border-0 rounded-xl"><CardContent className="p-5 h-32" /></Card>
              <Card className="border-0 rounded-xl"><CardContent className="p-5 h-24" /></Card>
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-secondary/60 via-secondary/90 to-secondary" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
            className="relative -mt-32 z-10 pb-8"
          >
            <div className="bg-card/80 backdrop-blur-sm border border-border/40 rounded-2xl shadow-elevated max-w-xl mx-auto overflow-hidden">
              <div className="px-6 pt-8 pb-5 text-center space-y-3">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-[18px] sm:text-[20px] font-extrabold text-foreground leading-tight">
                  See Exactly Where You Are Losing Patients
                </h2>
                <p className="text-[13px] text-muted-foreground/70 max-w-sm mx-auto leading-relaxed">
                  Enter your details to unlock your full diagnostic report.
                </p>
                <ul className="text-left max-w-xs mx-auto space-y-2 pt-2">
                  {["Complete visibility breakdown", "Conversion friction analysis", "Priority actions ranked by impact", "Modeled revenue opportunity", "Downloadable PDF report"].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[12px] text-foreground/80">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-5 pb-6">
                <LeadCaptureForm onSubmit={handleLeadSubmit} loading={leadSubmitting} />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── FULL REPORT (unlocked) ──
  const risk = getRiskLevel(scores.authority_gap_score);
  const RiskIcon = risk.Icon;

  return (
    <div ref={reportRef} className="min-h-[calc(100vh-56px)] bg-secondary">

      {/* ── 1. HEADER ─────────────────────────────────────────────────────────── */}
      <header className="bg-ihd-nav text-primary-foreground sticky top-0 z-30 border-b border-white/10 shadow-sm">
        <div className="container max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-bold hidden sm:block shrink-0">
                Authority Gap
              </span>
              <div className="h-4 w-px bg-primary-foreground/20 hidden sm:block shrink-0" />
              <span className="text-[13px] font-semibold opacity-90 truncate">{input.website_url}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {IS_MOCK_MODE && <PreviewBadge />}
              <Button
                variant="outline" size="sm"
                className="bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-[12px] rounded-lg h-8"
                onClick={handleExportPdf} disabled={exporting}
              >
                {exporting ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Download className="h-3 w-3 mr-1.5" />}
                Export PDF
              </Button>
              <Button
                variant="outline" size="sm"
                className="bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-[12px] rounded-lg h-8"
                onClick={handleSave}
              >
                <Save className="h-3 w-3 mr-1.5" />
                {user ? "Save" : "Sign in"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. HERO DIAGNOSTIC SUMMARY ────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="bg-card border-b border-border/40"
      >
        <div className="container max-w-6xl px-4 py-10 sm:py-12">
          <div className="grid lg:grid-cols-[1fr_210px] gap-10 items-start">

            {/* Left: Diagnosis text */}
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wide ${risk.bgColor} ${risk.textColor}`}>
                  <RiskIcon className="h-3 w-3" />
                  {risk.label}
                </span>
                <span className="text-[12px] text-muted-foreground font-medium">
                  {input.clinic_type} · {input.location}
                </span>
              </div>

              <h1 className="text-[22px] sm:text-[28px] font-extrabold text-foreground leading-[1.25]">
                {getDiagnosis(scores.authority_gap_score, input.clinic_type)}
              </h1>

              <p className="text-[13px] text-muted-foreground/80 leading-relaxed max-w-xl">
                Your authority score of{" "}
                <strong className="text-foreground font-bold">{scores.authority_gap_score}/100</strong>{" "}
                {getScoreContext(scores.authority_gap_score)}
              </p>

              {/* Top 3 Business Risks */}
              {top_fixes.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <p className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-muted-foreground">
                    Top Business Risks Identified
                  </p>
                  <div className="space-y-2">
                    {top_fixes.slice(0, 3).map((fix, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${RISK_BADGE[fix.severity] ?? "bg-muted text-muted-foreground"}`}>
                          {fix.severity.toUpperCase()}
                        </span>
                        <p className="text-[13px] font-semibold text-foreground leading-snug">{fix.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link to="/strategy-call" onClick={() => trackEvent("strategy_clicked", input.website_url)}>
                  <Button size="lg" className="gap-2 text-[13px] rounded-lg px-7 h-11 font-bold">
                    Book Strategy Review <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="outline" size="lg"
                  className="border-border text-foreground gap-2 text-[13px] rounded-lg px-6 h-11 font-bold"
                  onClick={handleExportPdf} disabled={exporting}
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download PDF
                </Button>
              </div>
            </div>

            {/* Right: Score ring */}
            <div className="flex flex-col items-center gap-3 lg:pt-2 lg:border-l lg:border-border/40 lg:pl-10">
              <ScoreRing score={scores.authority_gap_score} label="" size={160} />
              <div className="text-center">
                <p className="text-[11px] font-bold text-foreground">Overall Authority Score</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Out of 100 possible points</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full mt-2">
                <div className="text-center p-2.5 rounded-lg bg-muted/50">
                  <p className="text-[16px] font-extrabold text-foreground">{scores.visibility_score}<span className="text-[10px] text-muted-foreground font-normal">/40</span></p>
                  <p className="text-[9px] text-muted-foreground font-medium mt-0.5">Visibility</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-muted/50">
                  <p className="text-[16px] font-extrabold text-foreground">{scores.conversion_score}<span className="text-[10px] text-muted-foreground font-normal">/40</span></p>
                  <p className="text-[9px] text-muted-foreground font-medium mt-0.5">Conversion</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="container max-w-6xl px-4 py-7 sm:py-8 space-y-8 sm:space-y-10">

        {/* ── 3. EXECUTIVE SNAPSHOT ───────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        >
          <SectionHeading
            title="Diagnostic Overview"
            subtitle="Your performance across three core patient acquisition dimensions — click any card to jump to the full analysis"
          />
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            <SnapshotCard
              title="Visibility Gap"
              subtitle="Search Authority"
              score={scores.visibility_score}
              max={40}
              icon={<Search className="h-4 w-4" />}
              summary={visibility.summary}
              status={getStatusLabel(scores.visibility_score, 40)}
              onClick={() => visibilityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            />
            <SnapshotCard
              title="Conversion Gap"
              subtitle="Patient Acquisition"
              score={scores.conversion_score}
              max={40}
              icon={<MousePointerClick className="h-4 w-4" />}
              summary={conversion.summary}
              status={getStatusLabel(scores.conversion_score, 40)}
              onClick={() => conversionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            />
            <SnapshotCard
              title="Growth Potential"
              subtitle="Revenue Opportunity"
              score={scores.opportunity_score}
              max={20}
              icon={<TrendingUp className="h-4 w-4" />}
              summary={opportunity.summary}
              status={getStatusLabel(scores.opportunity_score, 20)}
              onClick={() => opportunityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              highlight={`$${estimated_revenue_low.toLocaleString()}–$${estimated_revenue_high.toLocaleString()}/mo`}
            />
          </div>
        </motion.section>

        {/* ── 4. PRIORITY FIXES ───────────────────────────────────────────────── */}
        {top_fixes.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          >
            <SectionHeading
              title="Priority Fixes"
              subtitle="The highest-impact changes to make first, ranked by business impact"
            />
            <div className="space-y-3 mt-4">
              {top_fixes.map((fix, i) => (
                <PriorityFixCard key={fix.id ?? i} fix={fix} rank={i + 1} />
              ))}
            </div>
          </motion.section>
        )}

        {/* ── 5. DETAILED DIAGNOSTIC SECTIONS ─────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        >
          <SectionHeading
            title="Full Diagnostic"
            subtitle="Deep analysis across all three dimensions — expand each section to view complete findings"
          />
          <div className="space-y-4 mt-4">

            <DiagnosticSection
              title="Visibility Gap"
              subtitle="Search Authority Analysis"
              icon={<Search className="h-4 w-4" />}
              score={scores.visibility_score}
              max={40}
              status={getStatusLabel(scores.visibility_score, 40)}
              summary={visibility.summary}
              sectionRef={visibilityRef}
            >
              <IntelligenceBlock
                title="Visibility Gap"
                subtitle="Search Authority Analysis"
                icon={<Search className="h-4 w-4" />}
                section={{
                  score: scores.visibility_score,
                  maxScore: 40,
                  status: getStatusLabel(scores.visibility_score, 40),
                  summary: visibility.summary,
                  findings: visibility.findings,
                  systemInsight: visibility.system_insight,
                  strategicImplication: visibility.strategic_implication,
                  recommendedDirections: visibility.recommended_directions,
                }}
              />
            </DiagnosticSection>

            <DiagnosticSection
              title="Conversion Gap"
              subtitle="Patient Acquisition Analysis"
              icon={<BarChart3 className="h-4 w-4" />}
              score={scores.conversion_score}
              max={40}
              status={getStatusLabel(scores.conversion_score, 40)}
              summary={conversion.summary}
              sectionRef={conversionRef}
            >
              <IntelligenceBlock
                title="Conversion Gap"
                subtitle="Patient Acquisition Analysis"
                icon={<BarChart3 className="h-4 w-4" />}
                section={{
                  score: scores.conversion_score,
                  maxScore: 40,
                  status: getStatusLabel(scores.conversion_score, 40),
                  summary: conversion.summary,
                  findings: conversion.findings,
                  systemInsight: conversion.system_insight,
                  strategicImplication: conversion.strategic_implication,
                  recommendedDirections: conversion.recommended_directions,
                }}
              />
            </DiagnosticSection>

            <DiagnosticSection
              title="Growth Potential"
              subtitle="Patient Revenue Analysis"
              icon={<TrendingUp className="h-4 w-4" />}
              score={scores.opportunity_score}
              max={20}
              status={getStatusLabel(scores.opportunity_score, 20)}
              summary={opportunity.summary}
              sectionRef={opportunityRef}
            >
              <IntelligenceBlock
                title="Growth Potential"
                subtitle="Patient Revenue Analysis"
                icon={<TrendingUp className="h-4 w-4" />}
                section={{
                  score: scores.opportunity_score,
                  maxScore: 20,
                  status: getStatusLabel(scores.opportunity_score, 20),
                  summary: opportunity.summary,
                  findings: opportunity.findings,
                  systemInsight: opportunity.system_insight,
                  strategicImplication: opportunity.strategic_implication,
                  recommendedDirections: opportunity.recommended_directions,
                }}
                confidenceLevel={opportunity.confidence_level}
                modelInputs={opportunity.model_inputs}
              />
            </DiagnosticSection>
          </div>
        </motion.section>

        {/* Methodology */}
        <Card className="border-0 shadow-sm rounded-xl border-l-4 border-l-muted-foreground/15">
          <CardContent className="p-5">
            <p className="text-[11px] text-muted-foreground/70 leading-[1.7]">
              <strong className="text-foreground/80 font-bold">Methodology: </strong>
              {methodology || `Revenue opportunity ranges are based on live analysis of site structure, estimated local search demand, click-share benchmarks, and assumed conversion rates for ${input.clinic_type.toLowerCase()} practices. These figures represent modeled opportunity ranges and are not audited financial projections.`}
            </p>
          </CardContent>
        </Card>

        {/* ── 6. FINAL ACTION PLAN ────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        >
          <Card className="shadow-elevated border-0 rounded-xl border-t-4 border-t-primary overflow-hidden">
            <CardContent className="py-10 sm:py-12 text-center space-y-6 px-5 sm:px-8">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-[18px] sm:text-[20px] font-extrabold text-foreground leading-tight">
                  Ready to Close These Gaps?
                </h3>
                <p className="text-[13px] text-muted-foreground/70 max-w-lg mx-auto leading-[1.7]">
                  Your diagnostic is complete. The path forward is clear — get a personalized strategy to act on these findings.
                </p>
              </div>

              {/* Improvement roadmap */}
              <div className="grid sm:grid-cols-3 gap-3 text-left max-w-2xl mx-auto">
                {[
                  "Review your top priority fixes above",
                  "Book a strategy session to build your action plan",
                  "Track improvement with monthly diagnostics",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                    <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-[11px] font-extrabold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-[12px] font-medium text-foreground leading-snug">{step}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <Link to="/strategy-call" onClick={() => trackEvent("strategy_clicked", input.website_url)}>
                  <Button size="lg" className="gap-2 text-[13px] rounded-lg px-6 h-12 font-bold">
                    Book Strategy Review <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="outline" size="lg"
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-2 text-[13px] rounded-lg px-6 h-12 font-bold"
                  onClick={handleExportPdf} disabled={exporting}
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {exporting ? "Exporting…" : "Download PDF"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/50 font-medium">
                Understand exactly where your practice can improve patient acquisition
              </p>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </div>
  );
};

export default ResultsPage;
