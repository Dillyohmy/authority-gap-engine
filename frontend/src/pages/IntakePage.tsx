import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  getProject,
  getAnswers,
  saveAnswers,
  getProgress,
  type Project,
  type SectionProgress,
} from "@/lib/projectsApi";
import { INTAKE_SECTIONS, type IntakeSection, type IntakeQuestion } from "@/config/intakeQuestions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Save,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

const AUTOSAVE_DELAY = 1500;

// ── Field renderers ───────────────────────────────────────────────────────────

function UrlField({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      type="url"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder}
      className="h-10 text-[13px]"
    />
  );
}

function TextField({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder}
      className="h-10 text-[13px]"
    />
  );
}

function TextareaField({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder}
      className="text-[13px] min-h-[100px] resize-y"
    />
  );
}

function SelectField({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {(question.options ?? []).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`text-left px-4 py-3 rounded-lg border text-[13px] font-medium transition-all ${
            value === opt
              ? "border-primary bg-primary/5 text-primary"
              : "border-border bg-background hover:border-primary/40 text-foreground"
          }`}
        >
          <span className="flex items-center gap-2.5">
            {value === opt ? (
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
            )}
            {opt}
          </span>
        </button>
      ))}
    </div>
  );
}

function YesNoField({
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-3">
      {["Yes", "No"].map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 py-3 rounded-lg border text-[13px] font-bold transition-all ${
            value === opt
              ? "border-primary bg-primary/5 text-primary"
              : "border-border bg-background hover:border-primary/40 text-foreground"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function MultiTextField({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const addItem = () => onChange([...value, ""]);
  const updateItem = (i: number, v: string) => {
    const next = [...value];
    next[i] = v;
    onChange(next);
  };
  const removeItem = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            placeholder={question.placeholder}
            className="h-10 text-[13px]"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeItem(i)}
            className="h-10 w-10 text-muted-foreground hover:text-destructive flex-shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="gap-1.5 text-[12px] h-8"
      >
        <Plus className="h-3.5 w-3.5" /> Add item
      </Button>
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const str = typeof value === "string" ? value : "";
  const arr = Array.isArray(value) ? (value as string[]) : [];

  switch (question.type) {
    case "url":
      return <UrlField question={question} value={str} onChange={onChange} />;
    case "text":
      return <TextField question={question} value={str} onChange={onChange} />;
    case "textarea":
      return <TextareaField question={question} value={str} onChange={onChange} />;
    case "select":
      return <SelectField question={question} value={str} onChange={onChange} />;
    case "yesno":
      return <YesNoField question={question} value={str} onChange={onChange} />;
    case "multitext":
      return (
        <MultiTextField
          question={question}
          value={arr.length > 0 ? arr : [""]}
          onChange={onChange}
        />
      );
    default:
      return <TextField question={question} value={str} onChange={onChange} />;
  }
}

// ── Section sidebar item ──────────────────────────────────────────────────────

function SectionTab({
  section,
  progress,
  active,
  onClick,
}: {
  section: IntakeSection;
  progress: SectionProgress | undefined;
  active: boolean;
  onClick: () => void;
}) {
  const isComplete = progress?.complete ?? false;
  const pct = progress?.pct ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
        active
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted text-foreground"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold truncate">{section.title}</span>
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
        ) : pct > 0 ? (
          <span className="text-[10px] text-muted-foreground font-medium flex-shrink-0">
            {pct}%
          </span>
        ) : (
          <Circle className="h-3.5 w-3.5 text-border flex-shrink-0" />
        )}
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const IntakePage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [progress, setProgress] = useState<SectionProgress[]>([]);
  const [overallPct, setOverallPct] = useState(0);
  const [readyForAudit, setReadyForAudit] = useState(false);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<string, unknown>>({});

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (!projectId) return;

    Promise.all([
      getProject(projectId),
      getAnswers(projectId),
      getProgress(projectId),
    ]).then(([proj, ans, prog]) => {
      setProject(proj);
      setAnswers(ans);
      setProgress(prog.sections);
      setOverallPct(prog.overallPct);
      setReadyForAudit(prog.readyForAudit);
      setLoading(false);
    }).catch(() => {
      navigate("/projects");
    });
  }, [user, projectId, navigate]);

  const flushSave = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!projectId || Object.keys(patch).length === 0) return;
      setSaving(true);
      try {
        await saveAnswers(projectId, patch);
        const prog = await getProgress(projectId);
        setProgress(prog.sections);
        setOverallPct(prog.overallPct);
        setReadyForAudit(prog.readyForAudit);
      } catch {
        toast.error("Auto-save failed. Check your connection.");
      } finally {
        setSaving(false);
      }
    },
    [projectId]
  );

  const handleChange = useCallback(
    (questionId: string, value: unknown) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
      setDirty((prev) => {
        const next = { ...prev, [questionId]: value };

        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(() => {
          setDirty((d) => {
            flushSave(d);
            return {};
          });
        }, AUTOSAVE_DELAY);

        return next;
      });
    },
    [flushSave]
  );

  const saveNow = async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await flushSave(dirty);
    setDirty({});
    toast.success("Progress saved");
  };

  const activeSection = INTAKE_SECTIONS[activeSectionIdx];
  const isFirst = activeSectionIdx === 0;
  const isLast = activeSectionIdx === INTAKE_SECTIONS.length - 1;

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-secondary">
        <p className="text-[13px] text-muted-foreground">Loading intake…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-secondary">
      {/* Header */}
      <div className="bg-ihd-nav text-primary-foreground">
        <div className="container max-w-6xl py-4 px-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/projects" className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-semibold">
                  Intake — {project?.name}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <div className="flex-1 bg-white/20 rounded-full h-1.5 max-w-[160px]">
                    <div
                      className="bg-white h-full rounded-full transition-all duration-500"
                      style={{ width: `${overallPct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold opacity-70">{overallPct}% complete</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {Object.keys(dirty).length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={saveNow}
                  disabled={saving}
                  className="text-white/70 hover:text-white hover:bg-white/10 gap-1.5 text-[11px] h-8"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Save now"}
                </Button>
              )}
              {readyForAudit && (
                <Link to={`/projects/${projectId}/review`}>
                  <Button size="sm" className="gap-1.5 text-[11px] h-8 bg-white text-ihd-dark-green hover:bg-white/90">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Review & Submit
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-48 flex-shrink-0 hidden md:block">
            <div className="sticky top-6 space-y-1">
              {INTAKE_SECTIONS.map((section, idx) => (
                <SectionTab
                  key={section.id}
                  section={section}
                  progress={progress.find((p) => p.id === section.id)}
                  active={idx === activeSectionIdx}
                  onClick={() => setActiveSectionIdx(idx)}
                />
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-5">
            <Card className="shadow-elevated border-0 rounded-xl">
              <div className="bg-ihd-dark-green/5 border-b px-6 py-4 rounded-t-xl">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">
                  Section {activeSectionIdx + 1} of {INTAKE_SECTIONS.length}
                </p>
                <h2 className="text-[18px] font-extrabold text-foreground mt-0.5">
                  {activeSection.title}
                </h2>
                <p className="text-[12px] text-muted-foreground/70 mt-1">
                  {activeSection.description}
                </p>
              </div>

              <CardContent className="p-6 space-y-7">
                {activeSection.questions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <Label className="text-[12px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5">
                      {q.label}
                      {q.required && (
                        <span className="text-destructive text-[10px]">*</span>
                      )}
                      {answers[q.id] && (
                        <Check className="h-3.5 w-3.5 text-success ml-auto" />
                      )}
                    </Label>
                    {q.hint && (
                      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                        {q.hint}
                      </p>
                    )}
                    <QuestionField
                      question={q}
                      value={answers[q.id] ?? (q.type === "multitext" ? [] : "")}
                      onChange={(v) => handleChange(q.id, v)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setActiveSectionIdx((i) => i - 1)}
                disabled={isFirst}
                className="gap-2 text-[12px] h-9"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Previous
              </Button>

              <div className="flex gap-1.5">
                {INTAKE_SECTIONS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveSectionIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === activeSectionIdx
                        ? "w-6 bg-primary"
                        : progress[i]?.complete
                        ? "w-3 bg-success"
                        : "w-1.5 bg-border"
                    }`}
                  />
                ))}
              </div>

              {isLast ? (
                <Link to={`/projects/${projectId}/review`}>
                  <Button className="gap-2 text-[12px] h-9">
                    Review Answers <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              ) : (
                <Button
                  onClick={() => setActiveSectionIdx((i) => i + 1)}
                  className="gap-2 text-[12px] h-9"
                >
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Auto-save status */}
            <p className="text-center text-[10px] text-muted-foreground/40">
              {saving
                ? "Saving…"
                : Object.keys(dirty).length > 0
                ? "Unsaved changes"
                : "All changes saved"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntakePage;
