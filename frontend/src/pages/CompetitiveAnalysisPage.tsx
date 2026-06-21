import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, Loader2, AlertCircle, BarChart3, Zap, TrendingUp, TrendingDown, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { competitorsApi, type CompetitiveGapAnalysis, type PriorityAction } from "@/lib/competitorsApi";
import CompetitiveScorecard from "@/components/competitors/CompetitiveScorecard";
import ComparisonTable from "@/components/competitors/ComparisonTable";

const POLL_INTERVAL = 4000;

const PRIORITY_COLORS: Record<PriorityAction["priority"], string> = {
  critical: "border-l-destructive bg-destructive/5",
  high: "border-l-orange-500 bg-orange-50",
  medium: "border-l-primary bg-primary/5",
  low: "border-l-muted bg-muted/30",
};

const PRIORITY_LABELS: Record<PriorityAction["priority"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const DIFFICULTY_LABELS = { easy: "Easy win", medium: "Medium effort", hard: "Long term" };

function PriorityActionCard({ action }: { action: PriorityAction }) {
  return (
    <div className={`border-l-4 rounded-r-xl p-4 ${PRIORITY_COLORS[action.priority]}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[13px] font-bold text-foreground">{action.title}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{action.category}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-muted-foreground">{PRIORITY_LABELS[action.priority]}</span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{action.description}</p>
          {action.supporting_observation && (
            <p className="text-[11px] text-muted-foreground/70 mt-1.5 flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" /> {action.supporting_observation}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-muted-foreground">{DIFFICULTY_LABELS[action.difficulty]}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{action.estimated_impact}</p>
        </div>
      </div>
    </div>
  );
}

export default function CompetitiveAnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { toast } = useToast();

  const [status, setStatus] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CompetitiveGapAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAnalysis = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await competitorsApi.getAnalysis(projectId);
      setStatus(data.status);
      if (data.analysis_json) setAnalysis(data.analysis_json);
      if (data.error_message) setError(data.error_message);
    } catch (e) {
      const msg = (e as Error).message;
      if (!msg.includes("404") && !msg.includes("not found")) setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAnalysis();
  }, [projectId]);

  useEffect(() => {
    const inProgress = status === "queued" || status === "processing";
    if (inProgress) {
      pollRef.current = setInterval(loadAnalysis, POLL_INTERVAL);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, loadAnalysis]);

  async function handleStart() {
    if (!projectId) return;
    setStarting(true);
    setError(null);
    try {
      await competitorsApi.startAnalysis(projectId);
      setStatus("queued");
      toast({ title: "Analysis started", description: "Comparing your site against competitor crawl data…" });
    } catch (e) {
      toast({ title: "Could not start analysis", description: (e as Error).message, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  }

  const inProgress = status === "queued" || status === "processing";

  return (
    <div className="min-h-screen bg-secondary">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={`/projects/${projectId}/competitors`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-[12px]">
                <ArrowLeft className="h-3.5 w-3.5" /> Competitors
              </Button>
            </Link>
            <div>
              <h1 className="text-[22px] font-extrabold text-foreground leading-tight">Competitive Analysis</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">Side-by-side authority gap comparison against your competitors.</p>
            </div>
          </div>
          {!inProgress && (
            <Button size="sm" onClick={handleStart} disabled={starting} className="gap-1.5 font-bold text-[12px] h-9 shrink-0">
              {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {analysis ? "Re-run Analysis" : "Run Analysis"}
            </Button>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* In-progress state */}
        {!loading && inProgress && (
          <Card className="border-0 shadow-elevated rounded-xl">
            <CardContent className="py-14 text-center space-y-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <BarChart3 className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <p className="text-[15px] font-extrabold">Analyzing competitors…</p>
              <p className="text-[12px] text-muted-foreground">Comparing authority signals, scoring gaps, and generating insights.</p>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {!loading && !inProgress && error && !analysis && (
          <Card className="border-0 shadow-sm rounded-xl">
            <CardContent className="py-10 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-[13px] text-muted-foreground">{error}</p>
              <p className="text-[12px] text-muted-foreground/60">Make sure at least one competitor has been crawled before running analysis.</p>
              <Button size="sm" onClick={handleStart} disabled={starting} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" /> Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No analysis yet */}
        {!loading && !inProgress && !analysis && !error && (
          <Card className="border-0 shadow-elevated rounded-xl">
            <CardContent className="py-14 text-center space-y-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-[16px] font-extrabold">No analysis yet</h3>
                <p className="text-[13px] text-muted-foreground mt-1 max-w-xs mx-auto">Crawl at least one competitor's website, then run the competitive analysis to see where you stand.</p>
              </div>
              <Button onClick={handleStart} disabled={starting} className="gap-2 font-bold text-[13px]">
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Run Analysis
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {!loading && analysis && (
          <div className="space-y-6">
            {/* Data completeness notice */}
            {analysis.data_completeness !== "full" && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200 text-[12px] text-yellow-800">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                {analysis.data_completeness === "partial"
                  ? "Not all competitors were crawled. Some scores are estimated from manual data only."
                  : "No competitor websites were crawled yet. Scores are based on manually entered data only. Results will improve after crawling."}
              </div>
            )}

            {/* Scorecard */}
            <Card className="border-0 shadow-elevated rounded-xl">
              <CardContent className="p-5">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground mb-4">Competitive Strength Score</p>
                <CompetitiveScorecard analysis={analysis} />
              </CardContent>
            </Card>

            {/* Gaps and advantages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {analysis.major_gaps.length > 0 || analysis.moderate_gaps.length > 0 ? (
                <Card className="border-0 shadow-sm rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-destructive">Gaps to Close</p>
                    </div>
                    <div className="space-y-1.5">
                      {analysis.major_gaps.map(g => (
                        <div key={g} className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                          <span className="text-[12px]">{g} <span className="text-[10px] text-destructive font-medium">Major</span></span>
                        </div>
                      ))}
                      {analysis.moderate_gaps.map(g => (
                        <div key={g} className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                          <span className="text-[12px]">{g} <span className="text-[10px] text-orange-600 font-medium">Moderate</span></span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {analysis.target_advantages.length > 0 && (
                <Card className="border-0 shadow-sm rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-success" />
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-success">Your Advantages</p>
                    </div>
                    <div className="space-y-1.5">
                      {analysis.target_advantages.map(a => (
                        <div key={a} className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                          <span className="text-[12px]">{a}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Comparison table */}
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground mb-3">Side-by-Side Comparison</p>
              <ComparisonTable analysis={analysis} />
            </div>

            {/* Priority actions */}
            {analysis.recommended_priority_actions.length > 0 && (
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground mb-3">Priority Actions</p>
                <div className="space-y-3">
                  {analysis.recommended_priority_actions.map((action, i) => (
                    <PriorityActionCard key={i} action={action} />
                  ))}
                </div>
              </div>
            )}

            {/* Footer meta */}
            <p className="text-[10px] text-muted-foreground/50 text-center">
              Analysis based on {analysis.analyzed_competitors} competitor{analysis.analyzed_competitors !== 1 ? "s" : ""} ·
              Data completeness: {analysis.data_completeness} ·
              Generated {new Date(analysis.generated_at).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
