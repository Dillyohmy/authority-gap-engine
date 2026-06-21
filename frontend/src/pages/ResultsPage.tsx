import { useRef, useState, useCallback, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, BarChart3, TrendingUp, ArrowRight, Lock, Save, Eye, MousePointerClick, Shield, Download, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/tracking";
import { getScanResult } from "@/lib/scanClient";
import KpiCard from "@/components/KpiCard";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import PriorityActionsTable from "@/components/PriorityActionsTable";
import ScoreRing from "@/components/ScoreRing";
import IntelligenceBlock from "@/components/IntelligenceBlock";
import ResultsTeaser from "@/components/ResultsTeaser";
import LeadCaptureForm, { type LeadData } from "@/components/LeadCaptureForm";
import ScanError from "@/components/ScanError";
import { exportReportPdf } from "@/lib/pdfExport";
import type { ScanReport } from "@/types/scanReport";
import { IS_MOCK_MODE } from "@/lib/mockScanData";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FlaskConical } from "lucide-react";

const ResultsPage = () => {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);

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
            .select("report_json, job_id")
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
            setUnlocked(true); // already saved — show full report
            setLoading(false);
            return;
          }

          // report_json not stored yet — fall back to fetching by job_id
          if (data.job_id) {
            const result = await getScanResult(data.job_id);
            if (!cancelled) { setReport(result); setUnlocked(true); setLoading(false); }
            return;
          }

          setFetchError("Report data not available for this scan.");
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
      findings_json: {
        visibility: report.visibility.findings,
        conversion: report.conversion.findings,
        topFixes: report.top_fixes,
      },
    }]).then(({ error }) => {
      if (error) console.warn("Could not auto-save scan:", error.message);
    });
  }, [report, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track teaser view when report loads
  useEffect(() => {
    if (report && !unlocked) {
      trackEvent("teaser_viewed", report.input.website_url);
    }
  }, [report]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track abandonment on unmount if not unlocked
  useEffect(() => {
    return () => {
      if (!unlocked && report) {
        trackEvent("abandoned", report.input.website_url);
      }
    };
  }, [unlocked, report]);

  const handleLeadSubmit = async (data: LeadData) => {
    if (!report) return;
    setLeadSubmitting(true);
    try {
      // Use centralized API client — routes to external backend when VITE_API_BASE_URL is set,
      // falls back to direct Supabase insert in mock mode.
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
        // Mock/preview mode — write directly to Supabase
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
    if (!user) {
      navigate("/auth");
      return;
    }
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

  const scoreColor = (s: number, max: number): "success" | "warning" | "critical" => {
    const pct = s / max;
    return pct >= 0.7 ? "success" : pct >= 0.4 ? "warning" : "critical";
  };

  // ── LOADING STATE ──
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

  // ── ERROR STATE ──
  if (fetchError || !report) {
    return (
      <ScanError
        message={fetchError || "Report data is missing or incomplete."}
        onRetry={() => navigate("/scan")}
      />
    );
  }

  const { input, scores, visibility, conversion, opportunity, top_fixes, estimated_revenue_low, estimated_revenue_high, executive_summary, methodology } = report;

  // ── GATED VIEW: Teaser + Lead Form ──
  if (!unlocked) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-secondary">
        {/* Header */}
        <div className="bg-ihd-nav text-primary-foreground">
          <div className="container max-w-5xl py-5 sm:py-6 px-4">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 font-semibold mb-1.5">Authority Gap Report</p>
                <h1 className="text-[20px] sm:text-[24px] font-extrabold leading-tight">{input.website_url}</h1>
                <p className="text-[12px] opacity-50 mt-1 font-medium">{input.clinic_type} · {input.location} · {new Date().toLocaleDateString()}</p>
              </div>
              {IS_MOCK_MODE && <PreviewBadge />}
            </motion.div>
          </div>
        </div>

        <div className="container max-w-5xl px-4 py-6 sm:py-8 space-y-8">
          {/* Teaser */}
          <ResultsTeaser report={report} />

          {/* Blurred preview of full report */}
          <div className="relative overflow-hidden rounded-xl">
            <div className="blur-[6px] opacity-40 pointer-events-none select-none space-y-4 px-4 py-6">
              <Card className="border-0 rounded-xl"><CardContent className="p-5 h-20" /></Card>
              <Card className="border-0 rounded-xl"><CardContent className="p-5 h-32" /></Card>
              <Card className="border-0 rounded-xl"><CardContent className="p-5 h-24" /></Card>
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-secondary/60 via-secondary/90 to-secondary" />
          </div>

          {/* Lead Gate */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
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
                  {[
                    "Complete visibility breakdown",
                    "Conversion friction analysis",
                    "Priority actions ranked by impact",
                    "Modeled revenue opportunity",
                    "Downloadable PDF report",
                  ].map((item) => (
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
  return (
    <div ref={reportRef} className="min-h-[calc(100vh-56px)] bg-secondary">
      {/* Report header */}
      <div className="bg-ihd-nav text-primary-foreground">
        <div className="container max-w-5xl py-5 sm:py-6 px-4">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 font-semibold mb-1.5">Authority Gap Report</p>
              <h1 className="text-[20px] sm:text-[24px] font-extrabold leading-tight">{input.website_url}</h1>
              <p className="text-[12px] opacity-50 mt-1 font-medium">{input.clinic_type} · {input.location} · {new Date().toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
              {IS_MOCK_MODE && <PreviewBadge />}
              <Button variant="outline" size="sm" className="bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-[12px] rounded-lg" onClick={handleExportPdf} disabled={exporting}>
                {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                {exporting ? "Exporting…" : "Export PDF"}
              </Button>
              <Button variant="outline" size="sm" className="bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-[12px] rounded-lg" onClick={handleSave}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {user ? "Save" : "Sign in"}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container max-w-5xl px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Hero: Authority Score */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.6 }}>
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="py-10 sm:py-12 flex flex-col items-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-5">Overall Authority Score</p>
              <ScoreRing score={scores.authority_gap_score} label="" size={190} />
              <p className="text-[12.5px] text-muted-foreground/60 mt-5 max-w-md text-center leading-relaxed">
                This score reflects your clinic's combined search visibility, conversion readiness, and competitive positioning based on live analysis.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* KPI Row */}
        <motion.div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <KpiCard label="Visibility" value={`${scores.visibility_score}/40`} subtitle="Search presence score" icon={<Eye className="h-4 w-4" />} color={scoreColor(scores.visibility_score, 40)} />
          <KpiCard label="Conversion" value={`${scores.conversion_score}/40`} subtitle="Patient capture score" icon={<MousePointerClick className="h-4 w-4" />} color={scoreColor(scores.conversion_score, 40)} />
          <KpiCard label="Revenue Opportunity" value={`$${estimated_revenue_low.toLocaleString()}–$${estimated_revenue_high.toLocaleString()}`} subtitle="Est. monthly patient revenue range" icon={<TrendingUp className="h-4 w-4" />} color="default" footnote="Based on live analysis" />
        </motion.div>

        {/* Executive Summary */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <ExecutiveSummary websiteUrl={input.website_url} clinicType={input.clinic_type} location={input.location} score={scores.authority_gap_score} summaryText={executive_summary} />
        </motion.div>

        {/* Diagnostic Intelligence Sections */}
        <div className="space-y-5 sm:space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-ihd-dark-green/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-ihd-dark-green" />
            </div>
            <div>
              <h2 className="text-[16px] sm:text-[18px] font-extrabold text-foreground leading-tight">Diagnostic Intelligence</h2>
              <p className="text-[11px] text-muted-foreground/60 font-medium">Structured analysis across three acquisition dimensions</p>
            </div>
          </div>

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
          <IntelligenceBlock
            title="Opportunity Engine"
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
        </div>

        {/* Priority Actions */}
        <PriorityActionsTable findings={top_fixes} title="Priority Actions — Top 3 Fixes" />

        {/* Methodology disclaimer */}
        <Card className="shadow-card border-0 rounded-xl border-l-4 border-l-muted-foreground/15">
          <CardContent className="p-5">
            <p className="text-[11px] text-muted-foreground/70 leading-[1.7]">
              <strong className="text-foreground/80 font-bold">Methodology:</strong> {methodology || `Revenue opportunity ranges are based on live analysis of site structure, estimated local search demand, click-share benchmarks, and assumed conversion rates for ${input.clinic_type.toLowerCase()} practices. These figures represent modeled opportunity ranges and are not audited financial projections. Actual outcomes depend on competitive dynamics, implementation quality, and market conditions.`}
            </p>
          </CardContent>
        </Card>

        {/* Post-Unlock CTA */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="shadow-elevated border-0 rounded-xl border-t-4 border-t-primary overflow-hidden">
            <CardContent className="py-10 sm:py-12 text-center space-y-5 px-5 sm:px-8">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-[18px] sm:text-[20px] font-extrabold text-foreground leading-tight">
                Your Full Diagnostic Is Ready
              </h3>
              <p className="text-[13px] text-muted-foreground/70 max-w-lg mx-auto leading-[1.7]">
                Based on your results, there are clear opportunities to improve patient acquisition.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                <Link to="/strategy-call" onClick={() => trackEvent("strategy_clicked", input.website_url)}>
                  <Button size="lg" className="gap-2 text-[13px] rounded-lg px-6 h-12 font-bold">
                    Book Strategy Review <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-2 text-[13px] rounded-lg px-6 h-12 font-bold"
                  onClick={handleExportPdf}
                  disabled={exporting}
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
        </motion.div>
      </div>
    </div>
  );
};

/** Derive status label from score ratio */
function getStatusLabel(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.7) return "Performing Within Range";
  if (pct >= 0.5) return "Constrained Performance";
  if (pct >= 0.3) return "Significant Gaps Detected";
  return "Severe Structural Weakness";
}

/** Preview Mode badge shown only in mock mode */
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

export default ResultsPage;
