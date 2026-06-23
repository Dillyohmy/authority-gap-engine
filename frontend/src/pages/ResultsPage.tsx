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
    <div className="space-y-1">
      <h2 className="text-[15px] sm:text-[17px] lg:text-[18px] font-extrabold text-foreground tracking-tight">{title}</h2>
      {subtitle && <p className="text-[12px] sm:text-[12.5px] text-muted-foreground leading-relaxed max-w-[60ch]">{subtitle}</p>}
    </div>
  );
}

function SnapshotCard({
  title, subtitle, score, max, icon, summary, status, onClick, highlight, displayValue,
}: {
  title: string; subtitle: string; score: number; max: number;
  icon: React.ReactNode; summary: string; status: string;
  onClick: () => void; highlight?: string; displayValue?: string;
}) {
  const pct = Math.min(score / max, 1);
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
            {displayValue
              ? <span className="text-[15px] font-extrabold leading-tight text-success text-right max-w-[110px]">{displayValue}</span>
              : <span className={`text-[22px] font-extrabold leading-none ${numColor}`}>{pctInt}<span className="text-[11px] font-bold text-muted-foreground">%</span></span>
            }
          </div>

          <div className="h-1.5 bg-muted rounded-full">
            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pctInt}%` }} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getSeverityBg(pct)}`}>{status}</span>
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
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary text-[13px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
            {rank}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <p className="text-[13px] sm:text-[14px] font-bold text-foreground leading-snug flex-1 min-w-0">{fix.label}</p>
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wide shrink-0 ${BADGE[fix.severity] ?? "bg-muted text-muted-foreground"}`}>
                {fix.severity} priority
              </span>
            </div>
            {fix.description && (
              <p className="text-[12px] sm:text-[12.5px] text-muted-foreground leading-relaxed">{fix.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-0.5">
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
          className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 min-h-[64px] text-left hover:bg-muted/20 active:bg-muted/30 transition-colors"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] sm:text-[14px] font-extrabold text-foreground">{title}</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">{subtitle}</span>
            </div>
            <p className="text-[11.5px] sm:text-[12px] text-muted-foreground mt-0.5 line-clamp-1">{summary}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="text-right">
              <span className={`text-[17px] sm:text-[20px] font-extrabold leading-none ${numColor}`}>{Math.round(pct * 100)}%</span>
              <p className="text-[9px] text-muted-foreground font-medium mt-0.5 whitespace-nowrap hidden sm:block">{status}</p>
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

function StickyReportSidebar({
  score, risk, topFix, url, onExport, exporting,
}: {
  score: number;
  risk: ReturnType<typeof getRiskLevel>;
  topFix?: ScanFinding;
  url: string;
  onExport: () => void;
  exporting: boolean;
}) {
  const RiskIcon = risk.Icon;
  return (
    <div className="sticky top-[58px] space-y-3">
      <Card className="border-0 shadow-elevated rounded-xl overflow-hidden">
        <div className="bg-ihd-dark-green px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-primary-foreground/50 mb-2">Authority Score</p>
          <div className="flex items-end gap-2">
            <span className="text-[42px] font-extrabold text-primary-foreground leading-none">{score}</span>
            <span className="text-[16px] text-primary-foreground/50 font-bold mb-1">/100</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 mt-2 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wide ${risk.bgColor} ${risk.textColor}`}>
            <RiskIcon className="h-3 w-3" />
            {risk.label}
          </span>
        </div>
        <CardContent className="p-4 space-y-4">
          {topFix && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-muted-foreground">Top Priority</p>
              <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full w-fit ${RISK_BADGE[topFix.severity] ?? "bg-muted text-muted-foreground"}`}>
                {topFix.severity.toUpperCase()} PRIORITY
              </div>
              <p className="text-[12px] font-semibold text-foreground leading-snug">{topFix.label}</p>
            </div>
          )}
          <Link to="/strategy-call" onClick={() => trackEvent("strategy_clicked", url)} className="block">
            <Button className="w-full gap-2 text-[12px] font-bold rounded-lg h-11">
              Book Strategy Call <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
            Free 30-min review of your top findings
          </p>
          <div className="border-t border-border/40 pt-3">
            <Button
              variant="ghost" size="sm"
              className="w-full gap-2 text-[11px] text-muted-foreground hover:text-foreground h-8 rounded-lg"
              onClick={onExport} disabled={exporting}
            >
              {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              {exporting ? "Exporting…" : "Download PDF Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-muted-foreground">What's in this report</p>
          {["Visibility & search analysis", "Conversion friction audit", "Revenue opportunity model", "Priority actions ranked by impact"].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[11px] text-foreground/70 font-medium">{item}</span>
            </div>
          ))}
        </CardContent>
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
  const [showStickyBar, setShowStickyBar] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

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

  // Show sticky mobile bar once hero scrolls out of view
  useEffect(() => {
    if (!unlocked) return;
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setShowStickyBar(!entry.isIntersecting), { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [unlocked]);

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
        ref={heroRef}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="bg-card border-b border-border/40"
      >
        <div className="container max-w-6xl px-4 py-7 sm:py-10 lg:py-12">
          {/*
            Mobile/tablet: flex-col-reverse → score ring renders above text (DOM second = visually first)
            Desktop (lg): switches to CSS grid → text left, score ring right (DOM order = column order)
          */}
          <div className="flex flex-col-reverse gap-7 sm:gap-8 lg:grid lg:grid-cols-[1fr_220px] lg:gap-10 lg:items-start">

            {/* ── Left column: Diagnosis text (DOM first → visually second on mobile) */}
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

              <h1 className="text-[20px] sm:text-[24px] lg:text-[28px] font-extrabold text-foreground leading-[1.25] max-w-[22ch]">
                {getDiagnosis(scores.authority_gap_score, input.clinic_type)}
              </h1>

              <p className="text-[13px] text-muted-foreground/80 leading-relaxed max-w-[56ch]">
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
                  <div className="space-y-2.5">
                    {top_fixes.slice(0, 3).map((fix, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${RISK_BADGE[fix.severity] ?? "bg-muted text-muted-foreground"}`}>
                          {fix.severity.toUpperCase()}
                        </span>
                        <p className="text-[13px] font-semibold text-foreground leading-snug">{fix.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="flex flex-col gap-2.5 pt-1">
                <Link to="/strategy-call" className="block" onClick={() => trackEvent("strategy_clicked", input.website_url)}>
                  <Button size="lg" className="w-full sm:w-auto gap-2 text-[14px] rounded-lg px-7 h-12 font-bold shadow-md">
                    Book My Strategy Call <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <p className="text-[11px] text-muted-foreground/60">
                  Free 30-min session · We walk through your top findings together
                </p>
                <Button
                  variant="outline" size="lg"
                  className="w-full sm:w-auto border-border text-foreground gap-2 text-[13px] rounded-lg px-6 h-11 font-semibold"
                  onClick={handleExportPdf} disabled={exporting}
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download Full Report PDF
                </Button>
              </div>
            </div>

            {/* ── Right column: Score ring (DOM second → visually first on mobile via flex-col-reverse) */}
            <div className="flex items-center justify-center gap-6 sm:gap-8 lg:flex-col lg:gap-4 lg:pt-2 lg:border-l lg:border-border/40 lg:pl-10">
              {/* Ring */}
              <div className="shrink-0">
                <ScoreRing score={scores.authority_gap_score} label="" size={140} />
              </div>
              {/* Score details — row on mobile (next to ring), stacked on desktop */}
              <div className="space-y-2.5 min-w-[140px] lg:w-full lg:text-center">
                <div>
                  <p className="text-[12px] font-bold text-foreground lg:text-center">Overall Authority Score</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 lg:text-center">Out of 100 possible points</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2.5 rounded-lg bg-muted/50">
                    <p className="text-[15px] font-extrabold text-foreground">{scores.visibility_score}<span className="text-[10px] text-muted-foreground font-normal">/40</span></p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Visibility</p>
                  </div>
                  <div className="text-center p-2.5 rounded-lg bg-muted/50">
                    <p className="text-[15px] font-extrabold text-foreground">{scores.conversion_score}<span className="text-[10px] text-muted-foreground font-normal">/40</span></p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Conversion</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="container max-w-6xl px-4 py-5 sm:py-7 lg:py-8 pb-[80px] lg:pb-8">
        <div className="grid lg:grid-cols-[1fr_268px] gap-8 items-start">
        <div className="space-y-7 sm:space-y-8 lg:space-y-10 min-w-0">

        {/* ── TABLET SECTION NAV (md only — sidebar handles desktop, bottom bar handles mobile) */}
        <nav className="hidden md:flex lg:hidden items-center gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label="Jump to section">
          {[
            { label: "Overview", onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
            { label: "Visibility", onClick: () => visibilityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) },
            { label: "Conversion", onClick: () => conversionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) },
            { label: "Growth Potential", onClick: () => opportunityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) },
          ].map(({ label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="shrink-0 text-[12px] font-semibold px-4 py-2 rounded-full bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-card transition-colors min-h-[36px]"
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ── 3. EXECUTIVE SNAPSHOT ───────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        >
          <SectionHeading
            title="Diagnostic Overview"
            subtitle="Your performance across three core patient acquisition dimensions — click any card to jump to the full analysis"
          />
          {/* 1-col on phone · 2-col on sm tablet · 3-col on lg desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-4">
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
            {/* On sm tablet: spans both columns so the revenue card gets full width below the pair */}
            <div className="sm:col-span-2 lg:col-span-1">
              <SnapshotCard
                title="Growth Potential"
                subtitle="Revenue Opportunity"
                score={scores.opportunity_score}
                max={scores.opportunity_score > 20 ? 100 : 20}
                icon={<TrendingUp className="h-4 w-4" />}
                summary={opportunity.summary}
                status={getStatusLabel(scores.opportunity_score, scores.opportunity_score > 20 ? 100 : 20)}
                onClick={() => opportunityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                displayValue={`$${estimated_revenue_low.toLocaleString()}–$${estimated_revenue_high.toLocaleString()}/mo`}
              />
            </div>
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

        {/* ── Mid-page contextual CTA ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.05] via-primary/[0.03] to-transparent p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
          <div className="flex-1 space-y-1">
            <p className="text-[14px] sm:text-[15px] font-extrabold text-foreground leading-snug">Want help fixing these issues?</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[52ch]">
              Let's turn this diagnostic into a clear, prioritized action plan for your practice.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1.5 w-full sm:w-auto shrink-0">
            <Link to="/strategy-call" className="block w-full sm:w-auto" onClick={() => trackEvent("strategy_clicked", input.website_url)}>
              <Button className="w-full sm:w-auto gap-2 text-[13px] font-bold rounded-lg h-11 px-5">
                Get My Action Plan <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <p className="text-[10px] text-muted-foreground/60 font-medium">Free · No commitment required</p>
          </div>
        </div>

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
              max={scores.opportunity_score > 20 ? 100 : 20}
              status={getStatusLabel(scores.opportunity_score, scores.opportunity_score > 20 ? 100 : 20)}
              summary={opportunity.summary}
              sectionRef={opportunityRef}
            >
              <IntelligenceBlock
                title="Growth Potential"
                subtitle="Patient Revenue Analysis"
                icon={<TrendingUp className="h-4 w-4" />}
                section={{
                  score: scores.opportunity_score,
                  maxScore: scores.opportunity_score > 20 ? 100 : 20,
                  status: getStatusLabel(scores.opportunity_score, scores.opportunity_score > 20 ? 100 : 20),
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
          <Card className="shadow-elevated border-0 rounded-xl overflow-hidden">
            {/* Top accent bar */}
            <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
            <CardContent className="p-6 sm:p-8 space-y-7">

              {/* Header */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-muted-foreground">Your Next Move</p>
                <h3 className="text-[20px] sm:text-[24px] font-extrabold text-foreground leading-tight">
                  The gaps are clear. The path forward is too.
                </h3>
                <p className="text-[13px] text-muted-foreground/80 leading-[1.7] max-w-2xl">
                  Your {input.clinic_type} practice is currently operating at a{" "}
                  <strong className="text-foreground font-bold">{risk.label.toLowerCase()}</strong> level with an authority score of{" "}
                  <strong className="text-foreground font-bold">{scores.authority_gap_score}/100</strong>. Addressing the top identified gaps could unlock an estimated{" "}
                  <strong className="text-foreground font-bold">${estimated_revenue_low.toLocaleString()}–${estimated_revenue_high.toLocaleString()}/mo</strong> in additional patient revenue.
                </p>
              </div>

              {/* What you get */}
              <div className="rounded-xl bg-muted/40 border border-border/50 p-5 space-y-3">
                <p className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-muted-foreground">What a strategy session includes</p>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {[
                    "Walk through your top 3 priority fixes",
                    "Identify which gaps to address first",
                    "Estimate ROI for each improvement",
                    "Build a 90-day action timeline",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-[12px] text-foreground/80 font-medium leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Link to="/strategy-call" onClick={() => trackEvent("strategy_clicked", input.website_url)}>
                  <Button size="lg" className="gap-2 text-[14px] rounded-lg px-8 h-12 font-bold shadow-md w-full sm:w-auto">
                    Book My Strategy Call <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="outline" size="lg"
                  className="border-border text-foreground gap-2 text-[13px] rounded-lg px-6 h-12 font-semibold w-full sm:w-auto"
                  onClick={handleExportPdf} disabled={exporting}
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {exporting ? "Exporting…" : "Download Full Report"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/50 font-medium -mt-3">
                Free · 30 minutes · No obligation to continue
              </p>

            </CardContent>
          </Card>
        </motion.section>

        </div>{/* end main column */}

        {/* ── DESKTOP STICKY SIDEBAR ───────────────────────────────────────────── */}
        <div className="hidden lg:block">
          <StickyReportSidebar
            score={scores.authority_gap_score}
            risk={risk}
            topFix={top_fixes[0]}
            url={input.website_url}
            onExport={handleExportPdf}
            exporting={exporting}
          />
        </div>

        </div>{/* end grid */}
      </div>{/* end container */}

      {/* ── MOBILE STICKY BOTTOM BAR ─────────────────────────────────────────── */}
      {showStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
          <div
            className="bg-ihd-nav/97 backdrop-blur-md border-t border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.18)] px-4 pt-3"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
          >
            <div className="flex items-center gap-3 max-w-lg mx-auto">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-primary-foreground/50 uppercase tracking-[0.14em] font-bold leading-none mb-1">
                  Authority Score
                </p>
                <p className="text-[15px] font-extrabold text-primary-foreground leading-none truncate">
                  {scores.authority_gap_score}<span className="text-primary-foreground/50 font-semibold text-[12px]">/100</span>
                  <span className={`ml-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${risk.bgColor} ${risk.textColor}`}>
                    {risk.label}
                  </span>
                </p>
              </div>
              <Link to="/strategy-call" className="shrink-0" onClick={() => trackEvent("strategy_clicked", input.website_url)}>
                <Button
                  size="sm"
                  className="gap-1.5 text-[12px] font-bold h-11 px-4 rounded-lg bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  Book Strategy Call <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsPage;
