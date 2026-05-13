import { Card, CardContent } from "@/components/ui/card";
import { Eye, MousePointerClick, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import ScoreRing from "@/components/ScoreRing";
import KpiCard from "@/components/KpiCard";
import FindingCard from "@/components/FindingCard";
import type { ScanReport } from "@/types/scanReport";

interface ResultsTeaserProps {
  report: ScanReport;
}

const ResultsTeaser = ({ report }: ResultsTeaserProps) => {
  const { scores, estimated_revenue_low, estimated_revenue_high, executive_summary, visibility, conversion, input } = report;

  const scoreColor = (s: number, max: number): "success" | "warning" | "critical" => {
    const pct = s / max;
    return pct >= 0.7 ? "success" : pct >= 0.4 ? "warning" : "critical";
  };

  const shortSummary = executive_summary || `Your clinic's online authority score is ${scores.authority_gap_score} out of 100, indicating ${
    scores.authority_gap_score >= 55 ? "moderate" : "significant"
  } gaps in visibility, conversion structure, and patient acquisition for ${input.clinic_type.toLowerCase()} practices in ${input.location}.`;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Authority Score */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.6 }}>
        <Card className="shadow-elevated border-0 rounded-xl">
          <CardContent className="py-10 sm:py-12 flex flex-col items-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-5">Overall Authority Score</p>
            <ScoreRing score={scores.authority_gap_score} label="" size={190} />
            <p className="text-[12.5px] text-muted-foreground/60 mt-5 max-w-md text-center leading-relaxed">
              This score reflects your clinic's combined search visibility, conversion readiness, and competitive positioning.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* KPI Row */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <KpiCard label="Visibility" value={`${scores.visibility_score}/40`} subtitle="Search presence score" icon={<Eye className="h-4 w-4" />} color={scoreColor(scores.visibility_score, 40)} />
        <KpiCard label="Conversion" value={`${scores.conversion_score}/40`} subtitle="Patient capture score" icon={<MousePointerClick className="h-4 w-4" />} color={scoreColor(scores.conversion_score, 40)} />
        <KpiCard label="Revenue Opportunity" value={`$${estimated_revenue_low.toLocaleString()}–$${estimated_revenue_high.toLocaleString()}`} subtitle="Est. monthly revenue range" icon={<TrendingUp className="h-4 w-4" />} color="default" footnote="Based on live analysis" />
      </motion.div>

      {/* Short Summary */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="shadow-elevated border-0 rounded-xl overflow-hidden">
          <div className="bg-ihd-dark-green px-5 sm:px-6 py-4">
            <h2 className="text-[15px] font-extrabold text-primary-foreground tracking-wide">Executive Summary</h2>
          </div>
          <CardContent className="p-5 sm:p-6">
            <div className="bg-secondary/40 rounded-xl px-5 py-4 border-l-4 border-primary">
              <p className="text-[13px] text-foreground/75 leading-[1.75]">{shortSummary}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sample Findings */}
      <motion.div className="space-y-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Sample Findings</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibility.findings.length > 0 && (
            <FindingCard finding={visibility.findings[0]} />
          )}
          {conversion.findings.length > 0 && (
            <FindingCard finding={conversion.findings[0]} />
          )}
        </div>
      </motion.div>

      {/* Opportunity teaser */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="shadow-card border-0 rounded-xl bg-secondary/60">
          <CardContent className="p-5 text-center">
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-bold mb-2">Opportunity Preview</p>
            <p className="text-[20px] sm:text-[24px] font-extrabold text-foreground">
              ${estimated_revenue_low.toLocaleString()}–${estimated_revenue_high.toLocaleString()}
            </p>
            <p className="text-[12px] text-muted-foreground/60 mt-1">Estimated monthly patient revenue not being captured</p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ResultsTeaser;
