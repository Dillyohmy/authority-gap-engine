import { apiFetch } from "./api";
import { supabase } from "@/integrations/supabase/client";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Project {
  id: string;
  name: string;
  website_url: string | null;
  clinic_type: string | null;
  location: string | null;
  status: "intake" | "ready" | "auditing" | "complete";
  created_at: string;
  updated_at: string;
}

export interface SectionProgress {
  id: string;
  title: string;
  total: number;
  done: number;
  requiredTotal: number;
  requiredDone: number;
  complete: boolean;
  pct: number;
}

export interface ProjectProgress {
  sections: SectionProgress[];
  totalQuestions: number;
  totalAnswered: number;
  totalRequired: number;
  requiredAnswered: number;
  overallPct: number;
  readyForAudit: boolean;
}

export interface MissingItem {
  questionId: string;
  label: string;
  sectionId: string;
  sectionTitle: string;
}

export async function listProjects(): Promise<Project[]> {
  const headers = await authHeaders();
  const res = await apiFetch<{ projects: Project[] }>("/api/projects", { headers });
  return res.projects;
}

export async function createProject(body: {
  name: string;
  website_url?: string;
  clinic_type?: string;
  location?: string;
}): Promise<Project> {
  const headers = await authHeaders();
  const res = await apiFetch<{ project: Project }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
  return res.project;
}

export async function getProject(id: string): Promise<Project> {
  const headers = await authHeaders();
  const res = await apiFetch<{ project: Project }>(`/api/projects/${id}`, { headers });
  return res.project;
}

export async function updateProjectStatus(
  id: string,
  status: Project["status"]
): Promise<Project> {
  const headers = await authHeaders();
  const res = await apiFetch<{ project: Project }>(`/api/projects/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    headers,
  });
  return res.project;
}

export async function getAnswers(
  projectId: string
): Promise<Record<string, unknown>> {
  const headers = await authHeaders();
  const res = await apiFetch<{ answers: Record<string, unknown> }>(
    `/api/projects/${projectId}/answers`,
    { headers }
  );
  return res.answers;
}

export async function saveAnswers(
  projectId: string,
  answers: Record<string, unknown>
): Promise<void> {
  const headers = await authHeaders();
  await apiFetch(`/api/projects/${projectId}/answers`, {
    method: "PUT",
    body: JSON.stringify({ answers }),
    headers,
  });
}

export async function getProgress(projectId: string): Promise<ProjectProgress> {
  const headers = await authHeaders();
  return apiFetch<ProjectProgress>(`/api/projects/${projectId}/progress`, {
    headers,
  });
}

export interface MissingUploadItem {
  category: string;
  label: string;
  auditArea: string;
}

export async function getMissing(
  projectId: string
): Promise<{ missing: MissingItem[]; optional: MissingItem[]; missingUploads: MissingUploadItem[]; optionalUploads: MissingUploadItem[] }> {
  const headers = await authHeaders();
  return apiFetch(`/api/projects/${projectId}/missing`, { headers });
}
