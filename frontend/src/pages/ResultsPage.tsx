import { useRef, useState, useCallback, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, BarChart3, TrendingUp, ArrowRight, Lock, Save, MousePointerClick,
  Download, Loader2, CheckCircle2, ChevronDown, ChevronUp,
  AlertTriangle, AlertCircle, Zap, Bookmark, BookmarkCheck, SlidersHorizontal, X,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/tracking";
import { getScanResult } from "@/lib/scanClient";
import ScoreRing from "@/components/ScoreRing";
import IntelligenceBlock from "@/components/IntelligenceBlock";
import SeverityBadge from "@/components/SeverityBadge";
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
    <div className="space-y-1.5">
      <h2 className="text-[18px] sm:text-[20px] lg:text-[22px] font-extrabold text-foreground tracking-tight leading-tight">{title}</h2>
      {subtitle && <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[65ch]">{subtitle}</p>}
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
  const iconBg   = pct >= 0.7 ? "bg-success/10 text-success" : pct >= 0.5 ? "bg-yellow-50 text-yellow-600" : pct >= 0.3 ? "bg-orange-50 text-orange-600" : "bg-destructive/10 text-destructive";

  return (
    <button onClick={onClick} className="w-full text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
      <Card className="border-0 shadow-elevated rounded-xl h-full transition-all duration-200 group-hover:shadow-prominent group-hover:ring-1 group-hover:ring-primary/20 group-hover:-translate-y-0.5">
        <CardContent className="p-5 sm:p-6 flex flex-col h-full gap-4">

          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                {icon}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-foreground leading-tight truncate">{title}</p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">{subtitle}</p>
              </div>
            </div>
            {displayValue
              ? <span className="text-[14px] font-extrabold leading-tight text-success text-right max-w-[110px] shrink-0">{displayValue}</span>
              : <span className={`text-[24px] font-extrabold leading-none shrink-0 ${numColor}`}>
                  {pctInt}<span className="text-[11px] font-bold text-muted-foreground ml-0.5">%</span>
                </span>
            }
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${pctInt}%` }} />
          </div>

          {/* Status */}
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getSeverityBg(pct)}`}>{status}</span>
            {highlight && <span className="text-[10px] font-bold text-success">{highlight}</span>}
          </div>

          {/* Summary */}
          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">{summary}</p>

          {/* CTA */}
          <p className="text-[10.5px] text-primary font-semibold flex items-center gap-1 group-hover:underline mt-auto">
            View full analysis <ArrowRight className="h-3 w-3" />
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

function PriorityFixCard({ fix, rank }: { fix: ScanFinding; rank: number }) {
  const EFFORT: Record<string, string> = { high: "Significant effort", medium: "Moderate effort", low: "Quick win" };

  const SEVERITY_BORDER: Record<string, string> = {
    high:   "border-l-[4px] border-l-[#DC2626]",
    medium: "border-l-[4px] border-l-[#D97706]",
    low:    "border-l-[4px] border-l-[#16A34A]",
  };
  const RANK_BG: Record<string, string> = {
    high:   "bg-[#FEF2F2] text-[#DC2626]",
    medium: "bg-[#FFFBEB] text-[#D97706]",
    low:    "bg-[#F0FDF4] text-[#16A34A]",
  };

  return (
    <Card className={`border-0 shadow-elevated rounded-xl overflow-hidden ${SEVERITY_BORDER[fix.severity] ?? ""}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {/* Rank circle — tinted by severity */}
          <div className={`h-9 w-9 rounded-full text-[14px] font-extrabold flex items-center justify-center shrink-0 mt-0.5 ${RANK_BG[fix.severity] ?? "bg-primary/10 text-primary"}`}>
            {rank}
          </div>

          <div className="flex-1 min-w-0 space-y-2.5">
            {/* Title row */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <p className="text-[14px] font-bold text-foreground leading-snug flex-1 min-w-0">{fix.label}</p>
              <SeverityBadge severity={fix.severity} />
            </div>

            {/* Description */}
            {fix.description && (
              <p className="text-[12.5px] text-muted-foreground leading-relaxed">{fix.description}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 pt-0.5">
              {fix.impact && (
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                  <span className="text-[11px] text-muted-foreground">{fix.impact}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-muted-foreground/70 shrink-0" />
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
  sectionId, reviewed, onToggleReviewed,
}: {
  title: string; subtitle: string; icon: React.ReactNode;
  score: number; max: number; status: string; summary: string;
  children: React.ReactNode;
  sectionRef?: React.RefObject<HTMLDivElement>;
  sectionId: string;
  reviewed?: boolean;
  onToggleReviewed?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.min(score / max, 1);
  const numColor = pct >= 0.7 ? "text-success" : pct >= 0.5 ? "text-yellow-600" : pct >= 0.3 ? "text-orange-600" : "text-destructive";
  const barColor = pct >= 0.7 ? "bg-success" : pct >= 0.5 ? "bg-yellow-400" : pct >= 0.3 ? "bg-orange-400" : "bg-destructive";
  const triggerId = `section-trigger-${sectionId}`;
  const panelId  = `section-panel-${sectionId}`;

  return (
    <div ref={sectionRef} className="scroll-mt-[72px]">
      <Card className={`border-0 shadow-elevated rounded-xl overflow-hidden transition-all duration-200 ${
        reviewed ? "ring-1 ring-success/30" : "hover:shadow-prominent"
      }`}>
        <button
          id={triggerId}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 sm:py-5 min-h-[68px] text-left hover:bg-muted/15 active:bg-muted/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          onClick={() => setExpanded(v => !v)}
        >
          {/* Icon */}
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            reviewed ? "bg-success/10 text-success" : expanded ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}>
            {reviewed ? <CheckCircle2 className="h-4.5 w-4.5" /> : icon}
          </div>

          {/* Title + summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] sm:text-[15px] font-extrabold text-foreground">{title}</span>
              {reviewed && (
                <span className="text-[10px] font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                  Reviewed
                </span>
              )}
              <span className="text-[10.5px] text-muted-foreground hidden sm:inline">{subtitle}</span>
            </div>
            <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1 leading-snug">{summary}</p>
          </div>

          {/* Score + progress + chevron */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="text-right hidden xs:block">
              <div className="flex items-baseline gap-1 justify-end">
                <span className={`text-[20px] sm:text-[22px] font-extrabold leading-none ${numColor}`}>
                  {Math.round(pct * 100)}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">%</span>
              </div>
              <div className="mt-1 w-[60px] h-1 bg-muted rounded-full overflow-hidden hidden sm:block">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct * 100}%` }} />
              </div>
            </div>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${expanded ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"}`}>
              {expanded
                ? <ChevronUp className="h-4 w-4" />
                : <ChevronDown className="h-4 w-4" />
              }
            </div>
          </div>
        </button>

        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className={`grid transition-[grid-template-rows] duration-250 ease-in-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-border/40">
              {children}
              {/* Mark reviewed footer */}
              <div className="px-5 py-3.5 bg-secondary/40 border-t border-border/30 flex items-center justify-between gap-4">
                <span className="text-[11px] text-muted-foreground/60 font-medium">
                  {reviewed ? "Section marked as reviewed" : "Mark when you're done reviewing"}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleReviewed?.(sectionId)}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    reviewed
                      ? "bg-success/10 text-success hover:bg-success/20 border border-success/20"
                      : "bg-muted text-muted-foreground hover:bg-success/10 hover:text-success"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  {reviewed ? "Reviewed" : "Mark as Reviewed"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

const SIDEBAR_SECTIONS = [
  { id: "overview",   label: "Diagnostic Overview" },
  { id: "priorities", label: "Priority Fixes" },
  { id: "visibility", label: "Visibility Gap" },
  { id: "conversion", label: "Conversion Gap" },
  { id: "growth",     label: "Growth Potential" },
  { id: "action",     label: "Action Plan" },
] as const;

function StickyReportSidebar({
  score, risk, topFix, url, onExport, exporting,
  activeSection, actionPlanCount, scrollTo,
}: {
  score: number;
  risk: ReturnType<typeof getRiskLevel>;
  topFix?: ScanFinding;
  url: string;
  onExport: () => void;
  exporting: boolean;
  activeSection: string;
  actionPlanCount: number;
  scrollTo: Record<string, () => void>;
}) {
  const RiskIcon = risk.Icon;
  return (
    <div className="sticky top-[58px] space-y-3">
      {/* Score card */}
      <Card className="border-0 shadow-elevated rounded-xl overflow-hidden">
        {/* Score header — dark premium treatment */}
        <div className="bg-[#1E2321] px-5 py-5">
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/40 mb-3">Authority Score</p>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-[46px] font-extrabold text-white leading-none">{score}</span>
            <span className="text-[16px] text-white/35 font-bold mb-1.5">/100</span>
          </div>
          {/* Mini score bar */}
          <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                score >= 70 ? "bg-[#4ADE80]" : score >= 50 ? "bg-[#FBBF24]" : score >= 30 ? "bg-[#FB923C]" : "bg-[#F87171]"
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wide ${risk.bgColor} ${risk.textColor}`}>
            <RiskIcon className="h-3 w-3 shrink-0" />
            {risk.label}
          </span>
        </div>

        <CardContent className="p-4 space-y-3.5">
          <Link to="/strategy-call" onClick={() => trackEvent("strategy_clicked", url)} className="block">
            <Button className="w-full gap-2 text-[12px] font-bold rounded-lg h-11 shadow-sm">
              Book Strategy Call <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed -mt-1">
            Free 30-min review · No obligation
          </p>

          <div className="border-t border-border/40 pt-3 space-y-1.5">
            <Button
              variant="ghost" size="sm"
              className="w-full gap-2 text-[11px] text-muted-foreground hover:text-foreground h-8 rounded-lg"
              onClick={onExport} disabled={exporting}
            >
              {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              {exporting ? "Exporting…" : "Download PDF"}
            </Button>
            {actionPlanCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/8 border border-primary/15">
                <Bookmark className="h-3 w-3 text-primary shrink-0" />
                <span className="text-[11px] text-primary font-semibold">
                  {actionPlanCount} item{actionPlanCount !== 1 ? "s" : ""} in action plan
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section nav */}
      <Card className="border-0 shadow-card rounded-xl overflow-hidden">
        <CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] font-extrabold text-muted-foreground/70 px-2 mb-2.5">Jump to Section</p>
          <nav aria-label="Report sections">
            {SIDEBAR_SECTIONS.map(({ id, label }) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  onClick={scrollTo[id]}
                  className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${isActive ? "bg-primary" : "bg-border"}`} />
                  {label}
                </button>
              );
            })}
          </nav>
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
  const [readProgress, setReadProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("overview");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [reviewedSections, setReviewedSections] = useState<Set<string>>(new Set());
  const [actionPlan, setActionPlan] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("aga-action-plan");
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  const heroRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const prioritiesRef = useRef<HTMLDivElement>(null);
  const finalCtaRef = useRef<HTMLDivElement>(null);

  const rm = useReducedMotion();

  // Shared reveal props for scroll-triggered sections (skipped when prefers-reduced-motion)
  const reveal = rm
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        whileInView: { opacity: 1, y: 0 } as Record<string, unknown>,
        viewport: { once: true, margin: "0px 0px -6% 0px" },
        transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as number[] },
      };

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

  // Reading progress bar
  useEffect(() => {
    if (!unlocked) return;
    const onScroll = () => {
      const el = reportRef.current;
      if (!el) return;
      const total = el.scrollHeight - window.innerHeight;
      setReadProgress(total > 0 ? Math.min(window.scrollY / total, 1) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [unlocked]);

  // Active section tracker — watches all anchored section refs
  useEffect(() => {
    if (!unlocked) return;
    const sectionMap: Array<{ id: string; ref: React.RefObject<HTMLDivElement> }> = [
      { id: "overview",    ref: overviewRef   },
      { id: "priorities",  ref: prioritiesRef },
      { id: "visibility",  ref: visibilityRef },
      { id: "conversion",  ref: conversionRef },
      { id: "growth",      ref: opportunityRef },
      { id: "action",      ref: finalCtaRef   },
    ];
    const targets = sectionMap.map(s => s.ref.current).filter(Boolean) as HTMLDivElement[];
    if (!targets.length) return;
    const obs = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const match = sectionMap.find(s => s.ref.current === entry.target);
          if (match) setActiveSection(match.id);
        }
      }
    }, { rootMargin: "-30% 0px -60% 0px", threshold: 0 });
    targets.forEach(t => obs.observe(t));
    return () => obs.disconnect();
  }, [unlocked]);

  const toggleActionPlan = (id: string) => {
    setActionPlan(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem("aga-action-plan", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const toggleReviewed = (id: string) => {
    setReviewedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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

  // Scroll-to helpers passed to sidebar + tablet nav
  const scrollTo = {
    overview:   () => overviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    priorities: () => prioritiesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    visibility: () => visibilityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    conversion: () => conversionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    growth:     () => opportunityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    action:     () => finalCtaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
  };

  return (
    <div ref={reportRef} className="min-h-[calc(100vh-56px)] bg-secondary">

      {/* ── Reading progress bar (fixed, sits just below header) ── */}
      <div className="fixed top-[58px] left-0 right-0 z-20 h-[3px] bg-border/20 pointer-events-none">
        <div
          className="h-full bg-primary transition-[width] duration-100 ease-linear"
          style={{ width: `${readProgress * 100}%` }}
          role="progressbar"
          aria-valuenow={Math.round(readProgress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Report reading progress"
        />
      </div>

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

              <h1 className="text-[22px] sm:text-[26px] lg:text-[30px] font-extrabold text-foreground leading-[1.22] tracking-tight">
                {getDiagnosis(scores.authority_gap_score, input.clinic_type)}
              </h1>

              <p className="text-[13.5px] text-muted-foreground/80 leading-[1.75] max-w-[56ch] lg:max-w-none">
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
                  <Button size="lg" className="w-full sm:w-auto gap-2 text-[14px] rounded-lg px-7 h-12 font-bold shadow-md active:scale-[0.97] transition-transform">
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
                  {[
                    { label: "Visibility", score: scores.visibility_score, max: 40 },
                    { label: "Conversion", score: scores.conversion_score, max: 40 },
                  ].map(({ label, score: s, max }) => {
                    const p = s / max;
                    const color = p >= 0.7 ? "text-success" : p >= 0.5 ? "text-yellow-600" : p >= 0.3 ? "text-orange-600" : "text-destructive";
                    const bar = p >= 0.7 ? "bg-success" : p >= 0.5 ? "bg-yellow-400" : p >= 0.3 ? "bg-orange-400" : "bg-destructive";
                    return (
                      <div key={label} className="text-center p-3 rounded-xl bg-muted/40 border border-border/40 space-y-1.5">
                        <p className={`text-[16px] font-extrabold leading-none ${color}`}>
                          {s}<span className="text-[9px] text-muted-foreground font-normal">/{max}</span>
                        </p>
                        <div className="h-1 bg-border/60 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${bar}`} style={{ width: `${p * 100}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
                      </div>
                    );
                  })}
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
          {SIDEBAR_SECTIONS.map(({ id, label }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                onClick={scrollTo[id]}
                className={`shrink-0 text-[12px] font-semibold px-4 py-2 rounded-full border transition-colors min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* ── 3. EXECUTIVE SNAPSHOT ───────────────────────────────────────────── */}
        <motion.section
          ref={overviewRef}
          id="section-overview"
          className="scroll-mt-[72px]"
          {...reveal}
        >
          <SectionHeading
            title="Diagnostic Overview"
            subtitle="Your performance across three core patient acquisition dimensions — click any card to jump to the full analysis"
          />
          {/* 1-col on phone · 2-col on sm tablet · 3-col on lg desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-4">
            {[
              {
                delay: 0,
                className: "",
                card: (
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
                ),
              },
              {
                delay: 0.07,
                className: "",
                card: (
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
                ),
              },
              {
                delay: 0.14,
                className: "sm:col-span-2 lg:col-span-1",
                card: (
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
                ),
              },
            ].map(({ delay, className, card }, i) => (
              <motion.div
                key={i}
                className={className}
                {...(rm ? {} : {
                  initial: { opacity: 0, y: 10 },
                  whileInView: { opacity: 1, y: 0 },
                  viewport: { once: true, margin: "0px 0px -4% 0px" },
                  transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as number[] },
                })}
              >
                {card}
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── 4. PRIORITY FIXES ───────────────────────────────────────────────── */}
        {top_fixes.length > 0 && (
          <motion.section
            ref={prioritiesRef}
            id="section-priorities"
            className="scroll-mt-[72px]"
            {...reveal}
          >
            <SectionHeading
              title="Priority Fixes"
              subtitle="The highest-impact changes to make first, ranked by business impact"
            />
            <div className="space-y-3 mt-4">
              {top_fixes.map((fix, i) => (
                <motion.div
                  key={fix.id ?? i}
                  {...(rm ? {} : {
                    initial: { opacity: 0, x: -6 },
                    whileInView: { opacity: 1, x: 0 },
                    viewport: { once: true, margin: "0px 0px -4% 0px" },
                    transition: { duration: 0.3, delay: i * 0.06, ease: "easeOut" },
                  })}
                >
                  <PriorityFixCard fix={fix} rank={i + 1} />
                </motion.div>
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
              <Button className="w-full sm:w-auto gap-2 text-[13px] font-bold rounded-lg h-11 px-5 active:scale-[0.97] transition-transform">
                Get My Action Plan <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <p className="text-[10px] text-muted-foreground/60 font-medium">Free · No commitment required</p>
          </div>
        </div>

        {/* ── 5. DETAILED DIAGNOSTIC SECTIONS ─────────────────────────────────── */}
        <motion.section {...reveal}>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-0 sm:justify-between mb-4">
            <SectionHeading
              title="Full Diagnostic"
              subtitle="Expand each section · bookmark issues · mark sections reviewed"
            />
            {/* Issue severity filter chips */}
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {[
                { id: null,     label: "All" },
                { id: "high",   label: "High Priority" },
                { id: "medium", label: "Medium" },
                { id: "low",    label: "Quick Wins" },
              ].map(({ id, label }) => {
                const isActive = activeFilter === id;
                return (
                  <button
                    key={String(id)}
                    onClick={() => setActiveFilter(isActive ? null : id)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              {activeFilter && (
                <button
                  onClick={() => setActiveFilter(null)}
                  aria-label="Clear filter"
                  className="h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <DiagnosticSection
              title="Visibility Gap"
              subtitle="Search Authority Analysis"
              icon={<Search className="h-4 w-4" />}
              score={scores.visibility_score}
              max={40}
              status={getStatusLabel(scores.visibility_score, 40)}
              summary={visibility.summary}
              sectionRef={visibilityRef}
              sectionId="visibility"
              reviewed={reviewedSections.has("visibility")}
              onToggleReviewed={toggleReviewed}
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
                activeFilter={activeFilter}
                actionPlanItems={actionPlan}
                onToggleActionPlan={toggleActionPlan}
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
              sectionId="conversion"
              reviewed={reviewedSections.has("conversion")}
              onToggleReviewed={toggleReviewed}
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
                activeFilter={activeFilter}
                actionPlanItems={actionPlan}
                onToggleActionPlan={toggleActionPlan}
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
              sectionId="growth"
              reviewed={reviewedSections.has("growth")}
              onToggleReviewed={toggleReviewed}
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
                activeFilter={activeFilter}
                actionPlanItems={actionPlan}
                onToggleActionPlan={toggleActionPlan}
              />
            </DiagnosticSection>
          </div>
        </motion.section>

        {/* Methodology */}
        <Card className="border-0 shadow-card rounded-xl border-l-[3px] border-l-border bg-secondary/30">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] text-muted-foreground/65 leading-[1.75]">
              <strong className="text-foreground/70 font-bold uppercase tracking-wide text-[10px]">Methodology · </strong>
              {methodology || `Revenue opportunity ranges are based on live analysis of site structure, estimated local search demand, click-share benchmarks, and assumed conversion rates for ${input.clinic_type.toLowerCase()} practices. These figures represent modeled opportunity ranges and are not audited financial projections.`}
            </p>
          </CardContent>
        </Card>

        {/* ── 6. FINAL ACTION PLAN ────────────────────────────────────────────── */}
        <motion.section
          ref={finalCtaRef}
          id="section-action"
          className="scroll-mt-[72px]"
          {...reveal}
        >
          <Card className="shadow-prominent border-0 rounded-xl overflow-hidden">
            {/* Top accent bar */}
            <div className="h-[3px] bg-gradient-to-r from-primary via-primary/80 to-primary/20" />
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
                  <Button size="lg" className="gap-2 text-[14px] rounded-lg px-8 h-12 font-bold shadow-md w-full sm:w-auto active:scale-[0.97] transition-transform">
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
            activeSection={activeSection}
            actionPlanCount={actionPlan.size}
            scrollTo={scrollTo}
          />
        </div>

        </div>{/* end grid */}
      </div>{/* end container */}

      {/* ── MOBILE STICKY BOTTOM BAR ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            initial={rm ? { opacity: 0 } : { y: "100%" }}
            animate={rm ? { opacity: 1 } : { y: 0 }}
            exit={rm ? { opacity: 0 } : { y: "100%" }}
            transition={rm
              ? { duration: 0.15 }
              : { type: "spring", damping: 28, stiffness: 280, mass: 0.8 }
            }
            className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
          >
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
                    className="gap-1.5 text-[12px] font-bold h-11 px-4 rounded-lg bg-primary-foreground text-primary hover:bg-primary-foreground/90 active:scale-[0.97] transition-transform"
                  >
                    Book Strategy Call <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResultsPage;
