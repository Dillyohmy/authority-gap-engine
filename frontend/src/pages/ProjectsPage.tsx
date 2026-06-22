import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { listProjects, type Project } from "@/lib/projectsApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  FolderOpen,
  ArrowRight,
  CheckCircle2,
  Clock,
  ClipboardList,
  Activity,
} from "lucide-react";

const STATUS_CONFIG: Record<
  Project["status"],
  { label: string; color: string; bg: string }
> = {
  intake: {
    label: "In Intake",
    color: "text-warning",
    bg: "bg-warning/10",
  },
  ready: {
    label: "Ready for Audit",
    color: "text-success",
    bg: "bg-success/10",
  },
  auditing: {
    label: "Auditing",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  complete: {
    label: "Complete",
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
};

const ProjectsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    listProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-secondary">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary animate-pulse" />
          <p className="text-[13px] text-muted-foreground">Loading projects…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-secondary">
      <div className="bg-ihd-nav text-primary-foreground">
        <div className="container max-w-5xl py-5 sm:py-6 px-4">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-semibold mb-1">
                Authority Gap Engine™
              </p>
              <h1 className="text-[20px] sm:text-[24px] font-extrabold leading-tight">
                Audit Projects
              </h1>
              <p className="text-[12px] opacity-40 mt-1 font-medium">
                {projects.length} {projects.length === 1 ? "project" : "projects"}
              </p>
            </div>
            <Link to="/projects/new">
              <Button size="sm" className="gap-2 rounded-lg font-bold text-[12px] px-5 h-10">
                <Plus className="h-3.5 w-3.5" />
                New Project
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container max-w-5xl px-4 py-6 sm:py-8">
        {projects.length === 0 ? (
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="py-16 text-center space-y-5">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <FolderOpen className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h3 className="text-[18px] font-extrabold text-foreground">No projects yet</h3>
                <p className="text-[13px] text-muted-foreground/70 mt-2 max-w-sm mx-auto">
                  Create your first audit project to begin the structured intake process for a practice.
                </p>
              </div>
              <Link to="/projects/new">
                <Button size="lg" className="gap-2 rounded-lg font-bold text-[13px] px-6 h-12 mt-2">
                  <Plus className="h-4 w-4" /> Create First Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const cfg = STATUS_CONFIG[project.status];
              return (
                <Card
                  key={project.id}
                  className="shadow-elevated border-0 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-stretch">
                    {/* Status column */}
                    <div className={`flex flex-col items-center justify-center px-4 py-5 ${cfg.bg} border-r min-w-[72px]`}>
                      {project.status === "complete" ? (
                        <CheckCircle2 className={`h-6 w-6 ${cfg.color}`} />
                      ) : project.status === "ready" ? (
                        <ClipboardList className={`h-6 w-6 ${cfg.color}`} />
                      ) : (
                        <Clock className={`h-6 w-6 ${cfg.color}`} />
                      )}
                      <span className={`text-[9px] font-extrabold uppercase tracking-[0.08em] mt-1.5 text-center leading-tight ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-foreground truncate">
                          {project.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          {project.website_url && (
                            <span className="text-[11px] text-muted-foreground/60 truncate max-w-[180px]">
                              {project.website_url}
                            </span>
                          )}
                          {project.clinic_type && (
                            <span className="text-[11px] text-muted-foreground/60">
                              {project.clinic_type}
                            </span>
                          )}
                          {project.location && (
                            <span className="text-[11px] text-muted-foreground/60">
                              {project.location}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground/40 mt-1.5">
                          Last updated {new Date(project.updated_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Link to={`/projects/${project.id}`}>
                          <Button
                            size="sm"
                            className="text-[12px] rounded-lg font-bold gap-1.5 h-9 px-4"
                          >
                            Open Dashboard <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                        {project.status === "intake" && (
                          <Link to={`/projects/${project.id}/intake`}>
                            <Button size="sm" variant="outline" className="text-[12px] rounded-lg h-9 px-3">
                              Intake
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsPage;
