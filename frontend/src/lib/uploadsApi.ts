/**
 * Upload Center API client
 * Handles file upload initiation, confirmation, listing, and parsing status.
 */

import { apiFetch } from "./api";

export type UploadStatus = "pending" | "uploaded" | "failed" | "deleted";
export type ParseStatus = "not_required" | "pending" | "processing" | "parsed" | "failed";

export interface UploadedFile {
  id: string;
  project_id: string;
  user_id: string;
  file_name: string;
  original_file_name: string;
  file_category: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  upload_status: UploadStatus;
  parse_status: ParseStatus;
  parse_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface InitiateUploadResponse {
  upload: UploadedFile;
  signed_url: string;
  token: string;
  storage_path: string;
}

export interface ParsedSummary {
  id: string;
  data_type: string;
  row_count: number;
  column_headers: string[];
  summary_json: Record<string, unknown>;
  created_at: string;
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Step 1: Tell the backend about the upcoming upload. Returns a signed URL. */
export async function initiateUpload(
  projectId: string,
  token: string,
  payload: {
    file_category: string;
    original_file_name: string;
    mime_type: string;
    file_size: number;
  }
): Promise<InitiateUploadResponse> {
  return apiFetch<InitiateUploadResponse>(`/api/projects/${projectId}/uploads`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
}

/** Step 2: PUT the file directly to Supabase Storage via the signed URL. */
export async function uploadFileToStorage(signedUrl: string, file: File): Promise<void> {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Storage upload failed (${res.status}): ${body}`);
  }
}

/** Step 3: Confirm the upload and trigger parsing. */
export async function confirmUpload(
  projectId: string,
  uploadId: string,
  token: string
): Promise<{ upload: UploadedFile }> {
  return apiFetch(`/api/projects/${projectId}/uploads/${uploadId}/confirm`, {
    method: "POST",
    headers: authHeader(token),
  });
}

/** Full upload flow: initiate → PUT → confirm */
export async function uploadFile(
  projectId: string,
  token: string,
  file: File,
  category: string,
  onProgress?: (phase: "initiating" | "uploading" | "confirming" | "done") => void
): Promise<UploadedFile> {
  onProgress?.("initiating");
  const initiated = await initiateUpload(projectId, token, {
    file_category: category,
    original_file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    file_size: file.size,
  });

  onProgress?.("uploading");
  await uploadFileToStorage(initiated.signed_url, file);

  onProgress?.("confirming");
  const confirmed = await confirmUpload(projectId, initiated.upload.id, token);

  onProgress?.("done");
  return confirmed.upload;
}

/** List all uploads for a project */
export async function listUploads(
  projectId: string,
  token: string
): Promise<{ uploads: UploadedFile[] }> {
  return apiFetch(`/api/projects/${projectId}/uploads`, {
    headers: authHeader(token),
  });
}

/** Delete an upload */
export async function deleteUpload(
  projectId: string,
  uploadId: string,
  token: string
): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/uploads/${uploadId}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

/** Get parse status */
export async function getParseStatus(
  projectId: string,
  uploadId: string,
  token: string
): Promise<{ id: string; parse_status: ParseStatus; parse_error: string | null }> {
  return apiFetch(`/api/projects/${projectId}/uploads/${uploadId}/parse-status`, {
    headers: authHeader(token),
  });
}

/** Get parsed summary */
export async function getParsedSummary(
  projectId: string,
  uploadId: string,
  token: string
): Promise<{ parsed: ParsedSummary }> {
  return apiFetch(`/api/projects/${projectId}/uploads/${uploadId}/summary`, {
    headers: authHeader(token),
  });
}

/** Get a signed download URL */
export async function getSignedUrl(
  projectId: string,
  uploadId: string,
  token: string
): Promise<{ signed_url: string }> {
  return apiFetch(`/api/projects/${projectId}/uploads/${uploadId}/signed-url`, {
    headers: authHeader(token),
  });
}

/** Trigger re-parse */
export async function triggerParse(
  projectId: string,
  uploadId: string,
  token: string
): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/uploads/${uploadId}/parse`, {
    method: "POST",
    headers: authHeader(token),
  });
}
