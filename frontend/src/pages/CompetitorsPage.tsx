import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Users, BarChart3, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { competitorsApi, type Competitor, type CompetitorFormData } from "@/lib/competitorsApi";
import CompetitorCard from "@/components/competitors/CompetitorCard";
import CompetitorForm from "@/components/competitors/CompetitorForm";

const POLL_INTERVAL = 5000;

export default function CompetitorsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { toast } = useToast();

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCompetitors = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await competitorsApi.list(projectId);
      setCompetitors(data);
    } catch (e) {
      if (loading) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId, loading]);

  useEffect(() => {
    loadCompetitors();
  }, [projectId]);

  // Poll while any competitor is in a transient crawl state
  useEffect(() => {
    const hasActive = competitors.some(c => c.crawl_status === "queued" || c.crawl_status === "processing");
    if (hasActive) {
      pollRef.current = setInterval(loadCompetitors, POLL_INTERVAL);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [competitors, loadCompetitors]);

  async function handleAdd(data: Partial<CompetitorFormData>) {
    if (!projectId) return;
    setAddSubmitting(true);
    try {
      const created = await competitorsApi.create(projectId, data);
      setCompetitors(prev => [...prev, created]);
      setShowAddForm(false);
      toast({ title: "Competitor added" });
    } catch (e) {
      toast({ title: "Could not add competitor", description: (e as Error).message, variant: "destructive" });
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleUpdate(id: string, data: Partial<CompetitorFormData>) {
    if (!projectId) return;
    const updated = await competitorsApi.update(projectId, id, data);
    setCompetitors(prev => prev.map(c => c.id === id ? updated : c));
    toast({ title: "Competitor updated" });
  }

  async function handleDelete(id: string) {
    if (!projectId) return;
    await competitorsApi.delete(projectId, id);
    setCompetitors(prev => prev.filter(c => c.id !== id));
    toast({ title: "Competitor deleted" });
  }

  async function handleStartCrawl(id: string) {
    if (!projectId) return;
    try {
      await competitorsApi.startCrawl(projectId, id);
      setCompetitors(prev => prev.map(c => c.id === id ? { ...c, crawl_status: "queued" as const } : c));
      toast({ title: "Crawl started", description: "We'll crawl up to 5 pages from this competitor's site." });
    } catch (e) {
      toast({ title: "Could not start crawl", description: (e as Error).message, variant: "destructive" });
    }
  }

  const crawledCount = competitors.filter(c => c.crawl_status === "completed").length;
  const canRunAnalysis = crawledCount >= 1;
  const atLimit = competitors.length >= 3;

  return (
    <div className="min-h-screen bg-secondary">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={`/projects/${projectId}/intake`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-[12px]">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-[22px] font-extrabold text-foreground leading-tight">Competitors</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">Add up to 3 competitors, crawl their websites, then run your gap analysis.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canRunAnalysis && (
              <Link to={`/projects/${projectId}/competitive-analysis`}>
                <Button size="sm" className="gap-1.5 font-bold text-[12px] h-9">
                  <BarChart3 className="h-3.5 w-3.5" /> View Analysis
                </Button>
              </Link>
            )}
            {!atLimit && !showAddForm && (
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)} className="gap-1.5 font-bold text-[12px] h-9">
                <Plus className="h-3.5 w-3.5" /> Add Competitor
              </Button>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Added", value: `${competitors.length} / 3`, active: competitors.length > 0 },
            { label: "Crawled", value: `${crawledCount}`, active: crawledCount > 0 },
            { label: "GBP URLs", value: `${competitors.filter(c => c.gbp_url).length}`, active: competitors.filter(c => c.gbp_url).length > 0 },
          ].map(item => (
            <Card key={item.label} className="border-0 shadow-sm rounded-xl">
              <CardContent className="p-3 text-center">
                <p className={`text-[22px] font-extrabold ${item.active ? "text-primary" : "text-muted-foreground/40"}`}>{item.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add form */}
        {showAddForm && (
          <Card className="border-0 shadow-elevated rounded-xl">
            <CardContent className="p-5">
              <p className="text-[12px] font-extrabold uppercase tracking-wide text-primary mb-4">New Competitor</p>
              <CompetitorForm
                onSubmit={handleAdd}
                onCancel={() => setShowAddForm(false)}
                submitting={addSubmitting}
              />
            </CardContent>
          </Card>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="border-0 shadow-sm rounded-xl">
            <CardContent className="py-10 text-center">
              <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
              <p className="text-[13px] text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        ) : competitors.length === 0 && !showAddForm ? (
          <Card className="border-0 shadow-elevated rounded-xl">
            <CardContent className="py-14 text-center space-y-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-[16px] font-extrabold">No competitors yet</h3>
                <p className="text-[13px] text-muted-foreground mt-1 max-w-xs mx-auto">Add competitors you found in the map pack or organic results to start your gap analysis.</p>
              </div>
              <Button onClick={() => setShowAddForm(true)} className="gap-2 font-bold text-[13px]">
                <Plus className="h-4 w-4" /> Add First Competitor
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {competitors.map(c => (
              <CompetitorCard
                key={c.id}
                competitor={c}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onStartCrawl={handleStartCrawl}
              />
            ))}
            {atLimit && (
              <p className="text-[11px] text-center text-muted-foreground">Maximum 3 competitors reached on the current plan.</p>
            )}
          </div>
        )}

        {/* Readiness checklist */}
        {competitors.length > 0 && (
          <Card className="border-0 shadow-sm rounded-xl">
            <CardContent className="p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground mb-3">Competitor Data Checklist</p>
              <div className="space-y-1.5">
                {[
                  { done: competitors.length >= 1, label: "At least 1 competitor added" },
                  { done: competitors.length >= 3, label: "3 competitors added (recommended)" },
                  { done: crawledCount >= 1, label: "At least 1 competitor site crawled" },
                  { done: crawledCount >= 3, label: "All competitors crawled" },
                  { done: competitors.some(c => c.gbp_url), label: "At least 1 GBP URL entered" },
                  { done: competitors.some(c => c.search_phrase), label: "Search phrase entered" },
                  { done: competitors.some(c => c.city_searched_from), label: "City searched from entered" },
                  { done: competitors.every(c => c.review_count != null), label: "Review counts for all competitors" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`h-3.5 w-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? "bg-success" : "bg-muted"}`}>
                      {item.done && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span className={`text-[12px] ${item.done ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
