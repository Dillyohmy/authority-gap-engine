import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Building2, Globe, MapPin, ClipboardList, Upload, Users, FileText, TrendingUp,
  Activity, ChevronRight, RefreshCw, AlertCircle, Link2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { dashboardApi, type DashboardViewModel } from "@/lib/dashboardApi";
import { reportsApi } from "@/lib/reportsApi";
import { growthPlansApi } from "@/lib/growthPlansApi";
import { AuthorityScoreSummary } from "@/components/dashboard/AuthorityScoreSummary";
import { NextBestActionCard } from "@/components/dashboard/NextBestActionCard";
import { PhaseTabContent } from "@/components/dashboard/PhaseTabContent";

const PHASES = [
  { key: "foundation", label: "Foundation" },
  { key: "local_authority", label: "Local Authority" },
  { key: "service_authority", label: "Service Authority" },
  { key: "trust_conversion", label: "Trust & Conversion" },
  { key: "competitive_ai_visibility", label: "Competitive & AI" },
] as const;

function QuickNavCard({ icon, label, href, description }: { icon: React.ReactNode; label: string; href: string; description: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(href)}
      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left hover:bg-muted/30 transition-colors w-full"
    >
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [data, setData] = useState<DashboardViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("foundation");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!projectId) return;
    try {
      const vm = await dashboardApi.get(projectId);
      setData(vm);
      setError(null);
    } catch (err) {
      setError((err as Error).message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    loadDashboard();
  }, [user, navigate, loadDashboard]);

  const handleGenerateReport = async () => {
    if (!projectId || !data?.latest_scan) return;
    setGeneratingReport(true);
    try {
      const result = await reportsApi.startFull(projectId);
      toast({ title: "Report generation started" });
      navigate(`/projects/${projectId}/reports/${result.report_id}`);
    } catch (e) {
      toast({ title: "Could not start report", description: (e as Error).message, variant: "destructive" });
      setGeneratingReport(false);
    }
  };

  const handleGenerateGrowthPlan = async () => {
    if (!projectId || !data?.latest_report) return;
    setGeneratingPlan(true);
    try {
      const result = await growthPlansApi.start(projectId, data.latest_report.id);
      toast({ title: "Growth plan generation started" });
      navigate(`/projects/${projectId}/growth-plans/${result.plan_id}`);
    } catch (e) {
      toast({ title: "Could not start growth plan", description: (e as Error).message, variant: "destructive" });
      setGeneratingPlan(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-secondary">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-secondary flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">Dashboard unavailable</h2>
          <p className="text-sm text-muted-foreground mb-4">{error || "Project not found or access denied."}</p>
          <Button variant="outline" onClick={() => navigate("/projects")}>Back to Projects</Button>
        </div>
      </div>
    );
  }

  const hasGrowthPlan = !!data.latest_growth_plan;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-secondary">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/projects" className="hover:text-foreground transition-colors">Projects</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{data.project.business_name || data.project.name}</span>
        </nav>

        {/* Score Summary */}
        <AuthorityScoreSummary
          data={data}
          projectId={projectId!}
          onGenerateReport={data.latest_scan && !data.latest_report ? handleGenerateReport : undefined}
          onGenerateGrowthPlan={data.latest_report && !data.latest_growth_plan ? handleGenerateGrowthPlan : undefined}
          generatingReport={generatingReport}
          generatingPlan={generatingPlan}
        />

        {/* Next Best Action */}
        <NextBestActionCard action={data.next_best_action} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

          {/* Phase Tabs — main content */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-0">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full h-auto rounded-none border-b bg-transparent p-0 flex">
                    {PHASES.map((p) => {
                      const phaseData = data.phases[p.key as keyof typeof data.phases];
                      const scoreStatus = phaseData?.score_status ?? "unknown";
                      const dotCls =
                        scoreStatus === "critical" ? "bg-red-500" :
                        scoreStatus === "needs_work" ? "bg-amber-500" :
                        scoreStatus === "good" || scoreStatus === "strong" ? "bg-emerald-500" : "bg-slate-300";

                      return (
                        <TabsTrigger
                          key={p.key}
                          value={p.key}
                          className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-3 px-2 flex-col gap-1 h-auto"
                        >
                          <div className="flex items-center gap-1.5">
                            <div className={`h-2 w-2 rounded-full ${dotCls}`} />
                            <span className="hidden sm:inline">{p.label}</span>
                            <span className="sm:hidden">{p.label.split(" ")[0]}</span>
                          </div>
                          {phaseData?.score !== null && phaseData?.score !== undefined && (
                            <span className="text-[10px] font-bold tabular-nums">{phaseData.score}</span>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {PHASES.map((p) => (
                    <TabsContent key={p.key} value={p.key} className="p-5 mt-0">
                      <PhaseTabContent
                        phase={data.phases[p.key as keyof typeof data.phases]}
                        projectId={projectId!}
                        hasGrowthPlan={hasGrowthPlan}
                        onGenerateGrowthPlan={data.latest_report ? handleGenerateGrowthPlan : undefined}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Quick navigation */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Project Navigation</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-1.5">
                <QuickNavCard
                  icon={<ClipboardList className="h-4 w-4" />}
                  label="Intake"
                  href={`/projects/${projectId}/intake`}
                  description={`${data.intake_progress.pct}% complete`}
                />
                <QuickNavCard
                  icon={<Link2 className="h-4 w-4" />}
                  label="Connected Sources"
                  href={`/projects/${projectId}/integrations`}
                  description="Google Search Console &amp; GA4"
                />
                <QuickNavCard
                  icon={<Upload className="h-4 w-4" />}
                  label="File Uploads"
                  href={`/projects/${projectId}/uploads`}
                  description="GSC, GA, screenshots"
                />
                <QuickNavCard
                  icon={<Users className="h-4 w-4" />}
                  label="Competitors"
                  href={`/projects/${projectId}/competitors`}
                  description={`${data.phases.competitive_ai_visibility.missing_inputs.filter(m => m.name.includes("Competitor")).length === 0 ? "Competitors added" : "Add competitors"}`}
                />
                {data.latest_report && (
                  <QuickNavCard
                    icon={<FileText className="h-4 w-4" />}
                    label="Full Authority Report"
                    href={`/projects/${projectId}/reports/${data.latest_report.id}`}
                    description="View full analysis"
                  />
                )}
                {data.latest_growth_plan && (
                  <QuickNavCard
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="Growth Plan"
                    href={`/projects/${projectId}/growth-plans/${data.latest_growth_plan.id}`}
                    description={`${data.latest_growth_plan.completed_tasks}/${data.latest_growth_plan.total_tasks} tasks done`}
                  />
                )}
              </CardContent>
            </Card>

            {/* Data completeness */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Audit Data</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Data completeness</span>
                  <span className={`font-semibold capitalize ${
                    data.data_completeness.level === "high" ? "text-emerald-600" :
                    data.data_completeness.level === "medium" ? "text-amber-600" : "text-red-600"
                  }`}>{data.data_completeness.level}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${
                      data.data_completeness.level === "high" ? "bg-emerald-500" :
                      data.data_completeness.level === "medium" ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${data.data_completeness.score}%` }}
                  />
                </div>
                {data.latest_scan && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                    <Activity className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Website scan: complete</span>
                  </div>
                )}
                {data.latest_report && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    <span>Full report: generated</span>
                  </div>
                )}
                {data.latest_growth_plan && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Growth plan: active</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upgrade CTA */}
            {!data.latest_growth_plan && (
              <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-5 text-center">
                <TrendingUp className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold mb-1">Turn findings into a roadmap</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Generate your Personal Authority Growth Plan to convert these recommendations into 30/60/90-day action items.
                </p>
                {data.latest_report ? (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                    onClick={handleGenerateGrowthPlan}
                    disabled={generatingPlan}
                  >
                    {generatingPlan ? "Generating…" : "Generate Growth Plan"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => navigate(`/projects/${projectId}/intake`)}
                  >
                    Complete intake first
                  </Button>
                )}
              </div>
            )}

            {/* Recent activity */}
            {data.recent_activity.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {data.recent_activity.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        {item.href ? (
                          <a href={item.href} className="font-medium hover:underline">{item.label}</a>
                        ) : (
                          <span className="font-medium">{item.label}</span>
                        )}
                        <div className="text-muted-foreground">
                          {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => { setLoading(true); loadDashboard(); }}
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Refresh dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
