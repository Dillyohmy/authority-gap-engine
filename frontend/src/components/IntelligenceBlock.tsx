import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ArrowRight, Brain, Crosshair, Layers, Info, ChevronRight } from "lucide-react";
import SeverityBadge from "./SeverityBadge";
import type { ScanFinding } from "@/types/scanReport";

/** Adapted GapSection shape for IntelligenceBlock consumption */
export interface IntelligenceSection {
  score: number;
  maxScore: number;
  status: string;
  summary: string;
  findings: ScanFinding[];
  systemInsight: string;
  strategicImplication: string;
  recommendedDirections: string[];
}

interface Props {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  section: IntelligenceSection;
  showAll?: boolean;
  confidenceLevel?: string;
  modelInputs?: string[];
  children?: React.ReactNode;
}

const IntelligenceBlock = ({ title, subtitle, icon, section, showAll, confidenceLevel, modelInputs, children }: Props) => {
  const pct = section.score / section.maxScore;
  const barColor = pct >= 0.7 ? "bg-success" : pct >= 0.4 ? "bg-warning" : "bg-destructive";
  const barBg = pct >= 0.7 ? "bg-success/15" : pct >= 0.4 ? "bg-warning/15" : "bg-destructive/15";
  const statusColor = pct >= 0.7 ? "text-success" : pct >= 0.4 ? "text-warning" : "text-destructive";
  const visibleFindings = showAll ? section.findings : section.findings.slice(0, 4);
  const hiddenCount = section.findings.length - visibleFindings.length;

  return (
    <Card className="shadow-elevated overflow-hidden border-0 rounded-xl">
      {/* ── Section Header ── */}
      <div className="bg-ihd-dark-green px-5 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary-foreground/10 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
            <span className="text-primary-foreground">{icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-extrabold text-primary-foreground tracking-wide leading-tight">{title}</h3>
            <p className="text-[10px] text-primary-foreground/45 tracking-[0.12em] uppercase font-semibold mt-0.5">{subtitle}</p>
          </div>
          <div className="flex-shrink-0 bg-primary-foreground/10 rounded-lg px-3.5 py-2 backdrop-blur-sm text-center">
            <span className="text-[22px] font-extrabold text-primary-foreground leading-none block">{section.score}</span>
            <span className="text-[10px] text-primary-foreground/40 font-semibold">of {section.maxScore}</span>
          </div>
        </div>
      </div>

      {/* ── Score Bar + Status ── */}
      <div className="px-5 sm:px-6 pt-5 pb-5 border-b">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground">Performance Level</span>
          <span className={`text-[11px] font-extrabold ${statusColor} tracking-wide`}>{section.status}</span>
        </div>
        <div className={`w-full rounded-full h-2.5 overflow-hidden ${barBg}`}>
          <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${pct * 100}%` }} />
        </div>
      </div>

      {/* ── System Overview ── */}
      <div className="px-5 sm:px-6 py-5 sm:py-6 border-b bg-secondary/20">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="h-1.5 w-5 bg-ihd-dark-green rounded-full" />
          <span className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-foreground">System Overview</span>
        </div>
        <p className="text-[13px] text-foreground/70 leading-[1.75]">{section.summary}</p>
      </div>

      {/* ── Model Inputs (Opportunity section) ── */}
      {modelInputs && modelInputs.length > 0 && (
        <div className="px-5 sm:px-6 py-5 border-b">
          <div className="rounded-xl border-2 border-dashed border-border bg-secondary/30 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-info/10 flex items-center justify-center">
                <Info className="h-3.5 w-3.5 text-info" />
              </div>
              <span className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-foreground">Opportunity Model Inputs</span>
            </div>
            <ul className="space-y-2.5 pl-0.5">
              {modelInputs.map((m) => (
                <li key={m} className="text-[12px] text-foreground/60 flex items-start gap-2.5">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
            {confidenceLevel && (
              <div className="flex items-center gap-2.5 pt-3 border-t border-dashed">
                <div className="h-2 w-2 rounded-full bg-info animate-pulse" />
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-[0.12em]">Confidence Level</span>
                <span className="text-[11px] text-foreground/55 font-medium">{confidenceLevel}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Core System Findings ── */}
      {visibleFindings.length > 0 && (
        <div className="px-5 sm:px-6 py-5 sm:py-6 border-b">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-1.5 w-5 bg-destructive rounded-full" />
            <span className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-foreground">Core System Findings</span>
            <span className="text-[10px] text-muted-foreground/60 font-semibold ml-auto tabular-nums">{visibleFindings.length} identified</span>
          </div>
          <div className="space-y-5">
            {visibleFindings.map((f, idx) => (
              <div key={f.id} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                {/* Finding header */}
                <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b bg-secondary/30">
                  <div className="h-7 w-7 rounded-lg bg-foreground/[0.04] border flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-extrabold text-muted-foreground tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="text-[13px] font-bold text-foreground flex-1 leading-snug">{f.label}</span>
                  <SeverityBadge severity={f.severity} />
                </div>

                <div className="px-4 sm:px-5 py-5 space-y-5">
                  {/* Signals */}
                  {f.signals && f.signals.length > 0 && (
                    <div className="rounded-lg bg-secondary/50 border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Crosshair className="h-3.5 w-3.5 text-muted-foreground/60" />
                        <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground">
                          Signals Analyzed
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {f.signals.map((s) => (
                          <span key={s} className="text-[10.5px] px-2.5 py-1 rounded-md bg-background text-foreground/55 border font-medium leading-tight">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interpretation */}
                  {f.interpretation && (
                    <div className="pl-0.5">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-3.5 w-3.5 text-info" />
                        <span className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-info">
                          Interpretation
                        </span>
                      </div>
                      <p className="text-[12.5px] text-foreground/70 leading-[1.7] pl-[22px]">{f.interpretation}</p>
                    </div>
                  )}

                  {/* Impact */}
                  {f.impact && (
                    <div className="rounded-lg bg-warning/[0.04] border border-warning/15 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        <span className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-warning">
                          Impact
                        </span>
                      </div>
                      <p className="text-[12px] text-foreground/65 leading-[1.7]">{f.impact}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hiddenCount > 0 && (
        <div className="px-5 sm:px-6 py-4 border-b">
          <div className="rounded-lg border-2 border-dashed border-border bg-secondary/30 px-4 py-3 text-center">
            <span className="text-[11px] text-muted-foreground font-semibold">+ {hiddenCount} additional findings available in the full report</span>
          </div>
        </div>
      )}

      {/* ── System Insight ── */}
      <div className="px-5 sm:px-6 py-6 border-b">
        <div className="rounded-xl border-l-[4px] border-primary bg-primary/[0.03] p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <span className="text-[12px] uppercase tracking-[0.12em] font-extrabold text-primary">System Insight</span>
          </div>
          <p className="text-[13px] text-foreground/80 leading-[1.8] font-medium">{section.systemInsight}</p>
        </div>
      </div>

      {/* ── Strategic Implication ── */}
      <div className="px-5 sm:px-6 py-6 border-b bg-foreground/[0.015]">
        <div className="rounded-xl border-l-[4px] border-warning bg-warning/[0.03] p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
            <span className="text-[12px] uppercase tracking-[0.12em] font-extrabold text-warning">Strategic Implication</span>
          </div>
          <p className="text-[13px] text-foreground/70 leading-[1.8]">{section.strategicImplication}</p>
        </div>
      </div>

      {/* ── Recommended Direction ── */}
      <div className="px-5 sm:px-6 py-6">
        <div className="rounded-xl border-l-[4px] border-ihd-dark-green bg-ihd-dark-green/[0.03] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-ihd-dark-green/10 flex items-center justify-center">
              <ArrowRight className="h-4 w-4 text-ihd-dark-green" />
            </div>
            <span className="text-[12px] uppercase tracking-[0.12em] font-extrabold text-ihd-dark-green">Recommended Direction</span>
          </div>
          <ol className="space-y-4 list-none">
            {section.recommendedDirections.map((d, i) => (
              <li key={i} className="flex items-start gap-3.5">
                <span className="h-6 w-6 rounded-full bg-ihd-dark-green text-primary-foreground text-[11px] font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-[12.5px] text-foreground/75 leading-[1.65]">{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {children}
    </Card>
  );
};

export default IntelligenceBlock;
