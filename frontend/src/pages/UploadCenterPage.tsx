import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { UploadCenter } from "@/components/uploads/UploadCenter";

interface Project {
  id: string;
  name: string;
  website_url: string;
  status: string;
}

export default function UploadCenterPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !session) navigate("/auth");
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (!session || !projectId) return;
    apiFetch<{ project: Project }>(`/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => setProject(res.project))
      .catch(() => navigate("/projects"))
      .finally(() => setProjectLoading(false));
  }, [session, projectId, navigate]);

  if (authLoading || projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  if (!session || !project || !projectId) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link to="/projects" className="hover:text-slate-700 transition-colors">
            Projects
          </Link>
          <span>/</span>
          <Link
            to={`/projects/${projectId}/intake`}
            className="hover:text-slate-700 transition-colors truncate max-w-[200px]"
          >
            {project.name}
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">Upload Center</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FolderOpen className="w-5 h-5 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">Upload Center</h1>
            </div>
            <p className="text-slate-500 text-sm">
              Upload audit support files for <span className="font-medium">{project.name}</span>.
              CSV exports are automatically parsed and analyzed.
            </p>
          </div>
          <Link
            to={`/projects/${projectId}/intake`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md px-3 py-2 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Intake
          </Link>
        </div>

        <UploadCenter projectId={projectId} token={session.access_token} />
      </div>
    </div>
  );
}
