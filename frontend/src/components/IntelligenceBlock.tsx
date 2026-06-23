import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, Brain, Crosshair, Layers, Info, ChevronRight,
  ChevronDown, ChevronUp, Bookmark, BookmarkCheck, TrendingUp,
} from "lucide-react";
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

const FINDING_KICKER: Record<string, { gradient: string; text: string; label: string }> = {
  high:   { gradient: "linear-gradient(180deg,#EF4444 0%,#DC2626 55%,#B91C1C 100%)", text: "#fff",    label: "Critical Issue" },
  medium: { gradient: "linear-gradient(180deg,#FBBF24 0%,#D97706 55%,#B45309 100%)", text: "#1a1200", label: "Warning"        },
  low:    { gradient: "linear-gradient(180deg,#34D399 0%,#16A34A 55%,#15803D 100%)", text: "#fff",    label: "Quick Win"      },
};

const IntelligenceBlock = ({
  title, subtitle, icon, section, showAll,
  confidenceLevel, modelInputs, children,
  activeFilter, actionPlanItems, onToggleActionPlan,
}: Props) => {
  const pct = Math.min(section.score / section.maxScore, 1);
  const barColor = pct >= 0.7 ? "bg-success" : pct >= 0.4 ? "bg-warning" : "bg-destructive";

  const [openFindingIds, setOpenFindingIds] = useState<Set<string>>(new Set());
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const justAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (justAddedTimerRef.current !== null) clearTimeout(justAddedTimerRef.current);
  }, []);

  const handleTogglePlan = (id: string) => {
    const isCurrentlyIn = actionPlanItems?.has(id) ?? false;
    onToggleActionPlan?.(id);
    if (!isCurrentlyIn) {
      if (justAddedTimerRef.current !== null) clearTimeout(justAddedTimerRef.current);
      setJustAdded(id);
      justAddedTimerRef.current = setTimeout(() => setJustAdded(null), 1600);
    }
  };

  const poolFindings = showAll ? section.findings : section.findings.slice(0, 6);
  const filteredFindings =
    activeFilter && activeFilter !== "all"
      ? poolFindings.filter(f => f.severity === activeFilter)
      : poolFindings;
  const hiddenCount = section.findings.length - poolFindings.length;

  const toggleFinding = (id: string) =>
    setOpenFindingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {modelInputs.map((m) => (
                <div key={m} className="flex items-start gap-2 rounded-lg bg-card border border-border/60 px-3 py-2">
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 mt-0.5 shrink-0" />
                  <span className="text-[11.5px] text-foreground/65 leading-snug">{m}</span>
                </div>
              ))}
            </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="list">
            {filteredFindings.map((f, idx) => {
              const isOpen = openFindingIds.has(f.id);
              const inPlan = actionPlanItems?.has(f.id) ?? false;
              const isFlash = justAdded === f.id;
              const triggerId = `finding-trigger-${f.id}`;
              const panelId = `finding-panel-${f.id}`;
              const kicker = FINDING_KICKER[f.severity] ?? FINDING_KICKER.medium;

              return (
                <div
                  key={f.id}
                  role="listitem"
                  className={`rounded-xl border bg-card overflow-hidden transition-all duration-200 ${
                    isOpen
                      ? "shadow-md ring-1 ring-primary/10"
                      : "shadow-sm hover:shadow-md hover:border-border/80"
                  } ${isFlash ? "ring-1 ring-primary/25" : ""}`}
                >
                  {/* ── Kicker header ── */}
                  <div
                    style={{
                      background: kicker.gradient,
                      color: kicker.text,
                      padding: "7px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
                    }}
                  >
                    <span style={{ fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      {kicker.label}
                    </span>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, opacity: 0.7, letterSpacing: "0.04em" }}>
                      {EFFORT_LABEL[f.severity]}
                    </span>
                  </div>

                  {/* ── Collapsed trigger ── */}
                  <button
                    id={triggerId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/15 active:bg-muted/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    onClick={() => toggleFinding(f.id)}
                  >
                    {/* Title + meta */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <span className="text-[12.5px] font-bold text-foreground leading-snug block">{f.label}</span>
                      {!isOpen && f.impact && (
                        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1 pr-2">{f.impact}</p>
                      )}
                    </div>

                    {/* Bookmark + chevron */}
                    <div className="flex items-center gap-0.5 shrink-0 ml-1 self-start mt-0.5">
                      <button
                        type="button"
                        aria-label={inPlan ? "Remove from action plan" : "Add to action plan"}
                        onClick={(e) => { e.stopPropagation(); handleTogglePlan(f.id); }}
                        className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          isFlash
                            ? "bg-primary/20 text-primary scale-125"
                            : inPlan
                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                            : "text-muted-foreground/30 hover:text-primary hover:bg-primary/5"
                        }`}
                      >
                        {inPlan || isFlash
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
                          <span className="text-[11px] text-muted-foreground/60 font-medium transition-colors duration-200">
                            {isFlash ? "✓ Saved to your action plan" : inPlan ? "Saved to your action plan" : "Track this for later"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleTogglePlan(f.id)}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                              isFlash
                                ? "bg-primary/15 text-primary scale-105"
                                : inPlan
                                ? "bg-primary/10 text-primary hover:bg-primary/15"
                                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            }`}
                          >
                            {inPlan || isFlash ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                            {isFlash ? "Added!" : inPlan ? "Added to Plan" : "Add to Plan"}
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
