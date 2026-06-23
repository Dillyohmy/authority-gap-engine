import { useState } from "react";
import {
  AlertTriangle, ArrowRight, Brain, Crosshair, Layers, Info, ChevronRight,
  ChevronDown, ChevronUp, Bookmark, BookmarkCheck, TrendingUp,
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

/** Left-border accent color per severity */
const FINDING_ACCENT: Record<string, string> = {
  high:   "border-l-[3px] border-l-[#DC2626]",
  medium: "border-l-[3px] border-l-[#D97706]",
  low:    "border-l-[3px] border-l-[#16A34A]",
};

const IntelligenceBlock = ({
  title, subtitle, icon, section, showAll,
  confidenceLevel, modelInputs, children,
  activeFilter, actionPlanItems, onToggleActionPlan,
}: Props) => {
  const pct = Math.min(section.score / section.maxScore, 1);
  const barColor = pct >= 0.7 ? "bg-success" : pct >= 0.4 ? "bg-warning" : "bg-destructive";

  const [openFindingId, setOpenFindingId] = useState<string | null>(null);

  const poolFindings = showAll ? section.findings : section.findings.slice(0, 6);
  const filteredFindings =
    activeFilter && activeFilter !== "all"
      ? poolFindings.filter(f => f.severity === activeFilter)
      : poolFindings;
  const hiddenCount = section.findings.length - poolFindings.length;

  const toggleFinding = (id: string) =>
    setOpenFindingId(prev => (prev === id ? null : id));

  return (
    <div className="divide-y divide-border/50">

      {/* ── Section Overview ────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-6 py-5 bg-secondary/25">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="h-[3px] w-8 rounded-full bg-primary shrink-0" />
          <span className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-foreground/60">Overview</span>
        </div>
        <p className="text-[13px] text-foreground/75 leading-[1.8] max-w-[72ch]">{section.summary}</p>

        {/* Compact performance bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.13em] font-bold text-muted-foreground">Performance</span>
            <span className="text-[11px] font-semibold text-foreground/65">{section.status}</span>
          </div>
          <div className="h-1.5 bg-border/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor} transition-all duration-700`}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Model Inputs (Opportunity section only) ─────────────────────────── */}
      {modelInputs && modelInputs.length > 0 && (
        <div className="px-5 sm:px-6 py-5">
          <div className="rounded-xl border-2 border-dashed border-border bg-secondary/40 p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                <Info className="h-3.5 w-3.5 text-info" />
              </div>
              <span className="text-[11px] uppercase tracking-[0.13em] font-extrabold text-foreground/65">Opportunity Model Inputs</span>
            </div>
            <ul className="space-y-2 pl-0.5">
              {modelInputs.map((m) => (
                <li key={m} className="text-[12px] text-foreground/60 flex items-start gap-2">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
            {confidenceLevel && (
              <div className="flex items-center gap-2.5 pt-3 border-t border-dashed">
                <div className="h-2 w-2 rounded-full bg-info animate-pulse shrink-0" />
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-[0.12em]">Confidence Level</span>
                <span className="text-[11px] text-foreground/55 font-medium">{confidenceLevel}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Core Findings Accordion ──────────────────────────────────────────── */}
      <div className="px-5 sm:px-6 py-5 sm:py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-[3px] w-8 rounded-full bg-destructive shrink-0" />
            <span className="text-[10px] uppercase tracking-[0.15em] font-extrabold text-foreground/60">Issues Found</span>
          </div>
          <span className="text-[10px] text-muted-foreground/55 font-semibold tabular-nums">
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
              const accentClass = FINDING_ACCENT[f.severity] ?? "";

              return (
                <div
                  key={f.id}
                  role="listitem"
                  className={`rounded-xl border bg-card overflow-hidden transition-all ${accentClass} ${
                    isOpen
                      ? "shadow-md ring-1 ring-primary/10"
                      : "shadow-sm hover:shadow-md hover:border-border/80"
                  }`}
                >
                  {/* ── Collapsed trigger ── */}
                  <button
                    id={triggerId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="w-full text-left flex items-start gap-3 px-4 py-3.5 min-h-[60px] hover:bg-muted/15 active:bg-muted/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    onClick={() => toggleFinding(f.id)}
                  >
                    {/* Index */}
                    <div className="h-5 w-5 rounded bg-foreground/[0.04] border border-border/60 flex items-center justify-center shrink-0 mt-1">
                      <span className="text-[9px] font-extrabold text-muted-foreground/70 tabular-nums leading-none">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-foreground leading-snug flex-1 min-w-[120px]">{f.label}</span>
                        <SeverityBadge severity={f.severity} />
                      </div>
                      {!isOpen && f.impact && (
                        <p className="text-[11.5px] text-muted-foreground leading-snug line-clamp-1 pr-2">{f.impact}</p>
                      )}
                      <span className="text-[10px] text-muted-foreground/50 font-medium">{EFFORT_LABEL[f.severity]}</span>
                    </div>

                    {/* Bookmark + chevron */}
                    <div className="flex items-center gap-0.5 shrink-0 ml-1 self-start mt-0.5">
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
                          ? <ChevronUp className="h-3.5 w-3.5" />
                          : <ChevronDown className="h-3.5 w-3.5" />
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
                      <div className="border-t border-border/40 px-4 sm:px-5 py-5 space-y-4 bg-secondary/15">

                        {/* What's happening */}
                        {f.description && (
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.13em] font-extrabold text-muted-foreground mb-2">What's Happening</p>
                            <p className="text-[12.5px] text-foreground/75 leading-[1.8]">{f.description}</p>
                          </div>
                        )}

                        {/* Signals analyzed */}
                        {f.signals && f.signals.length > 0 && (
                          <div className="rounded-xl bg-secondary/60 border border-border/60 p-3.5">
                            <div className="flex items-center gap-2 mb-2.5">
                              <Crosshair className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                              <span className="text-[10px] uppercase tracking-[0.13em] font-bold text-muted-foreground">Signals Analyzed</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {f.signals.map((s) => (
                                <span
                                  key={s}
                                  className="text-[10.5px] px-2 py-0.5 rounded-md bg-card text-foreground/60 border border-border/60 font-medium leading-tight"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Why it matters */}
                        {f.interpretation && (
                          <div className="rounded-xl bg-info/[0.04] border border-info/15 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Brain className="h-3.5 w-3.5 text-info shrink-0" />
                              <span className="text-[10px] uppercase tracking-[0.13em] font-extrabold text-info">Why It Matters</span>
                            </div>
                            <p className="text-[12.5px] text-foreground/70 leading-[1.75]">{f.interpretation}</p>
                          </div>
                        )}

                        {/* Recommended fix */}
                        {f.impact && (
                          <div className="rounded-xl bg-primary/[0.04] border border-primary/15 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="text-[10px] uppercase tracking-[0.13em] font-extrabold text-primary">Recommended Fix</span>
                            </div>
                            <p className="text-[12px] text-foreground/70 leading-[1.75]">{f.impact}</p>
                          </div>
                        )}

                        {/* Action plan toggle */}
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
          <div className="rounded-xl border border-dashed border-border/60 py-8 text-center">
            <p className="text-[13px] font-semibold text-foreground/50">
              No {activeFilter === "low" ? "quick-win" : activeFilter} priority findings in this section
            </p>
            <p className="text-[11px] text-muted-foreground/40 mt-1">Adjust the filter above to see more issues</p>
          </div>
        )}

        {hiddenCount > 0 && !activeFilter && (
          <div className="mt-3 rounded-lg border-2 border-dashed border-border bg-secondary/30 px-4 py-3 text-center">
            <span className="text-[11px] text-muted-foreground font-semibold">
              + {hiddenCount} additional findings in the full report
            </span>
          </div>
        )}
      </div>

      {/* ── System Insight ────────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-6 py-5 sm:py-6">
        <div className="rounded-xl border-l-4 border-primary bg-primary/[0.03] p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Layers className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[11px] uppercase tracking-[0.13em] font-extrabold text-primary">System Insight</span>
          </div>
          <p className="text-[13px] text-foreground/80 leading-[1.8] font-medium">{section.systemInsight}</p>
        </div>
      </div>

      {/* ── Strategic Implication ─────────────────────────────────────────────── */}
      <div className="px-5 sm:px-6 py-5 sm:py-6">
        <div className="rounded-xl border-l-4 border-warning bg-warning/[0.03] p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            </div>
            <span className="text-[11px] uppercase tracking-[0.13em] font-extrabold text-warning">Strategic Implication</span>
          </div>
          <p className="text-[13px] text-foreground/70 leading-[1.8]">{section.strategicImplication}</p>
        </div>
      </div>

      {/* ── Recommended Direction ─────────────────────────────────────────────── */}
      <div className="px-5 sm:px-6 py-5 sm:py-6">
        <div className="rounded-xl border-l-4 border-success bg-success/[0.03] p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <ArrowRight className="h-3.5 w-3.5 text-success" />
            </div>
            <span className="text-[11px] uppercase tracking-[0.13em] font-extrabold text-success">Recommended Direction</span>
          </div>
          <ol className="space-y-3.5 list-none">
            {section.recommendedDirections.map((d, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="h-5 w-5 rounded-full bg-success/12 text-success border border-success/20 text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-[12.5px] text-foreground/75 leading-[1.7]">{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {children}
    </div>
  );
};

export default IntelligenceBlock;
