import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle, ArrowRight, Brain, Crosshair, Layers, Info, ChevronRight,
  ChevronDown, ChevronUp, Bookmark, BookmarkCheck,
} from "lucide-react";
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
  activeFilter?: string | null;
  actionPlanItems?: Set<string>;
  onToggleActionPlan?: (id: string) => void;
}

const EFFORT_LABEL: Record<string, string> = {
  high: "High effort",
  medium: "Moderate effort",
  low: "Quick win",
};

const IntelligenceBlock = ({
  title, subtitle, icon, section, showAll,
  confidenceLevel, modelInputs, children,
  activeFilter, actionPlanItems, onToggleActionPlan,
}: Props) => {
  const pct = section.score / section.maxScore;
  const barColor = pct >= 0.7 ? "bg-success" : pct >= 0.4 ? "bg-warning" : "bg-destructive";
  const barBg   = pct >= 0.7 ? "bg-success/15" : pct >= 0.4 ? "bg-warning/15" : "bg-destructive/15";
  const statusColor = pct >= 0.7 ? "text-success" : pct >= 0.4 ? "text-warning" : "text-destructive";

  // One-open-at-a-time accordion per block
  const [openFindingId, setOpenFindingId] = useState<string | null>(null);

  const poolFindings = showAll ? section.findings : section.findings.slice(0, 6);
  const filteredFindings = activeFilter && activeFilter !== "all"
    ? poolFindings.filter(f => f.severity === activeFilter)
    : poolFindings;
  const hiddenCount = section.findings.length - poolFindings.length;

  const toggleFinding = (id: string) =>
    setOpenFindingId(prev => (prev === id ? null : id));

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

      {/* ── Core System Findings (Accordion) ── */}
      <div className="px-5 sm:px-6 py-5 sm:py-6 border-b">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-1.5 w-5 bg-destructive rounded-full" />
          <span className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-foreground">Core System Findings</span>
          <span className="text-[10px] text-muted-foreground/60 font-semibold ml-auto tabular-nums">
            {filteredFindings.length} of {poolFindings.length} shown
          </span>
        </div>

        {filteredFindings.length > 0 ? (
          <div className="space-y-2" role="list">
            {filteredFindings.map((f, idx) => {
              const isOpen = openFindingId === f.id;
              const inPlan = actionPlanItems?.has(f.id) ?? false;
              const triggerId = `finding-trigger-${f.id}`;
              const panelId = `finding-panel-${f.id}`;

              return (
                <div
                  key={f.id}
                  role="listitem"
                  className={`rounded-xl border bg-card overflow-hidden transition-shadow ${isOpen ? "shadow-md ring-1 ring-primary/15" : "shadow-sm"}`}
                >
                  {/* ── Collapsed trigger ── */}
                  <button
                    id={triggerId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="w-full text-left flex items-start gap-3 px-4 py-3.5 min-h-[60px] hover:bg-muted/20 active:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    onClick={() => toggleFinding(f.id)}
                  >
                    {/* Index number */}
                    <div className="h-6 w-6 rounded-md bg-foreground/[0.04] border flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-extrabold text-muted-foreground tabular-nums">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                    </div>

                    {/* Title + impact preview */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-foreground leading-snug flex-1 min-w-0">{f.label}</span>
                        <SeverityBadge severity={f.severity} />
                      </div>
                      {!isOpen && f.impact && (
                        <p className="text-[11.5px] text-muted-foreground line-clamp-1 leading-snug">{f.impact}</p>
                      )}
                      <span className="text-[10px] text-muted-foreground/55 font-medium">{EFFORT_LABEL[f.severity]}</span>
                    </div>

                    {/* Bookmark + chevron */}
                    <div className="flex items-center gap-1 shrink-0 ml-1 self-start mt-0.5">
                      <button
                        type="button"
                        aria-label={inPlan ? "Remove from action plan" : "Add to action plan"}
                        onClick={(e) => { e.stopPropagation(); onToggleActionPlan?.(f.id); }}
                        className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          inPlan
                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                            : "text-muted-foreground/30 hover:text-primary hover:bg-primary/5"
                        }`}
                      >
                        {inPlan
                          ? <BookmarkCheck className="h-3.5 w-3.5" />
                          : <Bookmark className="h-3.5 w-3.5" />
                        }
                      </button>
                      <div className="h-7 w-5 flex items-center justify-center text-muted-foreground/40 pointer-events-none">
                        {isOpen
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />
                        }
                      </div>
                    </div>
                  </button>

                  {/* ── Expanded panel (CSS grid animation) ── */}
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={triggerId}
                    className={`grid transition-[grid-template-rows] duration-250 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-border/40 px-4 sm:px-5 py-5 space-y-4 bg-secondary/20">

                        {/* What's happening */}
                        {f.description && (
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-muted-foreground mb-1.5">What's Happening</p>
                            <p className="text-[12.5px] text-foreground/75 leading-[1.75]">{f.description}</p>
                          </div>
                        )}

                        {/* Signals */}
                        {f.signals && f.signals.length > 0 && (
                          <div className="rounded-lg bg-secondary/50 border p-3.5">
                            <div className="flex items-center gap-2 mb-2.5">
                              <Crosshair className="h-3 w-3 text-muted-foreground/60" />
                              <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground">Signals Analyzed</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {f.signals.map((s) => (
                                <span key={s} className="text-[10.5px] px-2 py-0.5 rounded-md bg-background text-foreground/55 border font-medium leading-tight">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Why it matters */}
                        {f.interpretation && (
                          <div className="pl-0.5">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Brain className="h-3.5 w-3.5 text-info" />
                              <span className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-info">Why It Matters</span>
                            </div>
                            <p className="text-[12.5px] text-foreground/70 leading-[1.7] pl-[22px]">{f.interpretation}</p>
                          </div>
                        )}

                        {/* Recommended fix */}
                        {f.impact && (
                          <div className="rounded-lg bg-primary/[0.04] border border-primary/15 p-4">
                            <div className="flex items-center gap-2 mb-1.5">
                              <ArrowRight className="h-3.5 w-3.5 text-primary" />
                              <span className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-primary">Recommended Fix</span>
                            </div>
                            <p className="text-[12px] text-foreground/70 leading-[1.7]">{f.impact}</p>
                          </div>
                        )}

                        {/* Action plan toggle (bottom of expanded) */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/30">
                          <span className="text-[11px] text-muted-foreground/60 font-medium">
                            {inPlan ? "Saved to your action plan" : "Track this for later"}
                          </span>
                          <button
                            type="button"
                            onClick={() => onToggleActionPlan?.(f.id)}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                              inPlan
                                ? "bg-primary/10 text-primary hover:bg-primary/15"
                                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            }`}
                          >
                            {inPlan ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                            {inPlan ? "Added to Plan" : "Add to Plan"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty state when filter has no matches */
          <div className="rounded-xl border border-dashed border-border/60 py-8 text-center">
            <p className="text-[13px] font-semibold text-foreground/50">
              No {activeFilter === "low" ? "quick-win" : activeFilter} priority findings in this section
            </p>
            <p className="text-[11px] text-muted-foreground/40 mt-1">Adjust the filter above to see more issues</p>
          </div>
        )}

        {hiddenCount > 0 && !activeFilter && (
          <div className="mt-3 rounded-lg border-2 border-dashed border-border bg-secondary/30 px-4 py-3 text-center">
            <span className="text-[11px] text-muted-foreground font-semibold">+ {hiddenCount} additional findings available in the full report</span>
          </div>
        )}
      </div>

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
