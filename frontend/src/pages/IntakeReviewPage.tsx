import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  getProject,
  getAnswers,
  getProgress,
  getMissing,
  updateProjectStatus,
  type Project,
  type SectionProgress,
  type MissingItem,
  type MissingUploadItem,
} from "@/lib/projectsApi";
import { INTAKE_SECTIONS } from "@/config/intakeQuestions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Info,
  Send,
  Activity,
  Edit2,
  BarChart3,
  Loader2,
} from "lucide-react";
import { reportsApi } from "@/lib/reportsApi";
import { toast } from "sonner";

const IntakeReviewPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [sectionProgress, setSectionProgress] = useState<SectionProgress[]>([]);
  const [overallPct, setOverallPct] = useState(0);
  const [readyForAudit, setReadyForAudit] = useState(false);
  const [missing, setMissing] = useState<MissingItem[]>([]);
  const [optional, setOptional] = useState<MissingItem[]>([]);
  const [missingUploads, setMissingUploads] = useState<MissingUploadItem[]>([]);
  const [missingCompetitorItems, setMissingCompetitorItems] = useState<{ label: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (!projectId) return;

    Promise.all([
      getProject(projectId),
      getAnswers(projectId),
      getProgress(projectId),
      getMissing(projectId),
    ]).then(([proj, ans, prog, miss]) => {
      setProject(proj);
      setAnswers(ans);
      setSectionProgress(prog.sections);
      setOverallPct(prog.overallPct);
      setReadyForAudit(prog.readyForAudit);
      setMissing(miss.missing);
      setOptional(miss.optional);
      setMissingUploads(miss.missingUploads ?? []);
      setMissingCompetitorItems((miss as Record<string, unknown>).missingCompetitorItems as { label: string; description: string }[] ?? []);
      setLoading(false);
    }).catch(() => navigate("/projects"));
  }, [user, projectId, navigate]);

  const handleMarkReady = async () => {
    if (!projectId) return;
    setSubmitting(true);
    try {
      await updateProjectStatus(projectId, "ready");
      toast.success("Project marked ready for audit!");
      navigate("/projects");
    } catch {
      toast.error("Failed to update status. Please try again.");
      setSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!projectId) return;
    setGeneratingReport(true);
    try {
      const result = await reportsApi.startFull(projectId);
      navigate(`/projects/${projectId}/reports/${result.report_id}`);
    } catch (e) {
      toast.error((e as Error).message || "Failed to start report generation.");
      setGeneratingReport(false);
    }
  };

  const renderAnswerValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (Array.isArray(value)) return value.filter(Boolean).join(", ") || "—";
    if (typeof value === "string") return value.trim() || "—";
    return String(value);
  };

  const isAnswered = (value: unknown): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.filter(Boolean).length > 0;
    return true;
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-secondary">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary animate-pulse" />
          <p className="text-[13px] text-muted-foreground">Loading review…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-secondary">
      {/* Header */}
      <div className="bg-ihd-nav text-primary-foreground">
        <div className="container max-w-4xl py-4 px-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to={`/projects/${projectId}/intake`}
                className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-semibold">
                  Intake Review — {project?.name}
                </p>
                <p className="text-[14px] font-extrabold mt-0.5">
                  {overallPct}% complete · {missing.length} required{" "}
                  {missing.length === 1 ? "item" : "items"} missing
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl px-4 py-6 sm:py-8 space-y-6">
        {/* Status banner */}
        {readyForAudit ? (
          <Card className="shadow-elevated border-0 rounded-xl border-l-4 border-l-success overflow-hidden">
            <CardContent className="p-5 flex items-start gap-4">
              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[14px] font-bold text-foreground">
                  All required information is complete
                </p>
                <p className="text-[12px] text-muted-foreground/70 mt-0.5">
                  This project is ready to be submitted for audit generation.
                  {optional.length > 0 && ` ${optional.length} optional ${optional.length === 1 ? "item" : "items"} can still be added to improve the audit.`}
                </p>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <Button
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  className="gap-2 font-bold text-[12px] bg-ihd-dark-green hover:bg-ihd-dark-green/90"
                >
                  {generatingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                  {generatingReport ? "Starting…" : "Generate Report"}
                </Button>
                <Button
                  onClick={handleMarkReady}
                  disabled={submitting || project?.status === "ready"}
                  variant="outline"
                  className="gap-2 font-bold text-[12px]"
                >
                  <Send className="h-3.5 w-3.5" />
                  {project?.status === "ready" ? "Already Submitted" : submitting ? "Submitting…" : "Mark Ready"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-elevated border-0 rounded-xl border-l-4 border-l-destructive overflow-hidden">
            <CardContent className="p-5 flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-bold text-foreground">
                  {missing.length} required {missing.length === 1 ? "item" : "items"} still missing
                </p>
                <p className="text-[12px] text-muted-foreground/70 mt-0.5">
                  Complete all required fields before marking this project ready for audit.
                </p>
                <Link to={`/projects/${projectId}/intake`}>
                  <Button size="sm" className="mt-3 gap-1.5 text-[12px] h-8">
                    <Edit2 className="h-3.5 w-3.5" /> Back to Intake
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Missing required items */}
        {missing.length > 0 && (
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <h3 className="text-[13px] font-bold text-foreground">
                  Required — Missing ({missing.length})
                </h3>
              </div>
              <div className="space-y-2">
                {missing.map((item) => (
                  <Link
                    key={item.questionId}
                    to={`/projects/${projectId}/intake`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors group"
                  >
                    <div className="h-2 w-2 rounded-full bg-destructive flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60">
                        {item.sectionTitle}
                      </p>
                    </div>
                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Optional missing items */}
        {optional.length > 0 && (
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Info className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-[13px] font-bold text-foreground">
                  Optional — Not Yet Provided ({optional.length})
                </h3>
              </div>
              <div className="space-y-2">
                {optional.map((item) => (
                  <Link
                    key={item.questionId}
                    to={`/projects/${projectId}/intake`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                  >
                    <div className="h-2 w-2 rounded-full bg-border flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60">
                        {item.sectionTitle}
                      </p>
                    </div>
                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Missing uploads */}
        {missingUploads.length > 0 && (
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <h3 className="text-[13px] font-bold text-foreground">
                    Required Files Missing ({missingUploads.length})
                  </h3>
                </div>
                <Link
                  to={`/projects/${projectId}/uploads`}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Open Upload Center →
                </Link>
              </div>
              <div className="space-y-2">
                {missingUploads.map((item) => (
                  <Link
                    key={item.category}
                    to={`/projects/${projectId}/uploads`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors group"
                  >
                    <div className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60">{item.auditArea}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Missing competitor items */}
        {missingCompetitorItems.length > 0 && (
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  <h3 className="text-[13px] font-bold text-foreground">
                    Competitor Data Missing ({missingCompetitorItems.length})
                  </h3>
                </div>
                <Link
                  to={`/projects/${projectId}/competitors`}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Open Competitors →
                </Link>
              </div>
              <div className="space-y-2">
                {missingCompetitorItems.map((item, i) => (
                  <Link
                    key={i}
                    to={`/projects/${projectId}/competitors`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors group"
                  >
                    <div className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground/60">{item.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section progress */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 w-5 bg-ihd-dark-green rounded-full" />
            <span className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-foreground">
              Section Progress
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INTAKE_SECTIONS.map((section) => {
              const prog = sectionProgress.find((p) => p.id === section.id);
              return (
                <Card key={section.id} className="shadow-elevated border-0 rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <p className="text-[12px] font-bold text-foreground">
                        {section.title}
                      </p>
                      {prog?.complete ? (
                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {prog?.done ?? 0}/{prog?.total ?? 0}
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-border/40 rounded-full h-1.5">
                      <div
                        className={`h-full rounded-full transition-all ${
                          prog?.complete ? "bg-success" : "bg-primary"
                        }`}
                        style={{ width: `${prog?.pct ?? 0}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                      {prog?.requiredDone ?? 0}/{prog?.requiredTotal ?? 0} required complete
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Full answer review */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 w-5 bg-ihd-dark-green rounded-full" />
            <span className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-foreground">
              All Answers
            </span>
          </div>
          {INTAKE_SECTIONS.map((section) => (
            <Card key={section.id} className="shadow-elevated border-0 rounded-xl">
              <div className="bg-muted/30 border-b px-5 py-3 rounded-t-xl flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-foreground">
                  {section.title}
                </h3>
                <Link to={`/projects/${projectId}/intake`}>
                  <Button variant="ghost" size="sm" className="gap-1 text-[11px] h-7 text-muted-foreground hover:text-primary">
                    <Edit2 className="h-3 w-3" /> Edit
                  </Button>
                </Link>
              </div>
              <CardContent className="p-5 divide-y divide-border/50">
                {section.questions.map((q) => {
                  const val = answers[q.id];
                  const answered = isAnswered(val);
                  return (
                    <div key={q.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-2">
                        <div
                          className={`h-1.5 w-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                            answered
                              ? "bg-success"
                              : q.required
                              ? "bg-destructive"
                              : "bg-border"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em]">
                            {q.label}
                            {q.required && !answered && (
                              <span className="text-destructive ml-1">*</span>
                            )}
                          </p>
                          <p className="text-[13px] text-foreground mt-0.5 whitespace-pre-wrap break-words">
                            {renderAnswerValue(val)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom submit */}
        {readyForAudit && project?.status !== "ready" && (
          <div className="pb-6 space-y-3">
            <Button
              onClick={handleGenerateReport}
              disabled={generatingReport || submitting}
              size="lg"
              className="w-full h-12 font-bold text-[14px] gap-2 bg-ihd-dark-green hover:bg-ihd-dark-green/90"
            >
              {generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              {generatingReport ? "Starting Report…" : "Generate Full Authority Gap Report"}
            </Button>
            <Button
              onClick={handleMarkReady}
              disabled={submitting}
              variant="outline"
              size="lg"
              className="w-full h-12 font-bold text-[14px] gap-2"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Submitting…" : "Mark Project Ready for Audit"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntakeReviewPage;
