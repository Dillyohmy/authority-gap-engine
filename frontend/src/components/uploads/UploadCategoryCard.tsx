import { useRef, useState, useCallback } from "react";
import { Upload, Trash2, RefreshCw, Eye, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { UploadStatusBadge } from "./UploadStatusBadge";
import { ParseStatusBadge } from "./ParseStatusBadge";
import { ParsedSummaryPreview } from "./ParsedSummaryPreview";
import { uploadFile, deleteUpload, getSignedUrl, triggerParse, getParsedSummary } from "@/lib/uploadsApi";
import type { UploadedFile, ParsedSummary } from "@/lib/uploadsApi";

interface CategoryDef {
  id: string;
  label: string;
  description: string;
  helpText?: string;
  required: boolean;
  acceptedExtensions: string[];
  maxSizeBytes: number;
  fileType: string;
}

interface Props {
  projectId: string;
  token: string;
  category: CategoryDef;
  currentUpload: UploadedFile | null;
  onUploadComplete: (file: UploadedFile) => void;
  onUploadDeleted: (uploadId: string) => void;
}

type Phase = "idle" | "initiating" | "uploading" | "confirming" | "done";

const MB = 1024 * 1024;

export function UploadCategoryCard({
  projectId,
  token,
  category,
  currentUpload,
  onUploadComplete,
  onUploadDeleted,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [showSummary, setShowSummary] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const maxMB = Math.round(category.maxSizeBytes / MB);
  const accept = category.acceptedExtensions.join(",");
  const isUploading = phase !== "idle" && phase !== "done";

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!fileRef.current) return;
      fileRef.current.value = "";
      if (!file) return;

      if (file.size > category.maxSizeBytes) {
        toast.error(`File is too large. Maximum size is ${maxMB}MB.`);
        return;
      }

      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!category.acceptedExtensions.includes(ext)) {
        toast.error(`Unsupported file type. Accepted: ${category.acceptedExtensions.join(", ")}`);
        return;
      }

      try {
        const uploaded = await uploadFile(projectId, token, file, category.id, (p) =>
          setPhase(p as Phase)
        );
        onUploadComplete(uploaded);
        toast.success(`${category.label} uploaded successfully`);
        setPhase("idle");
        setParsedData(null);
        setShowSummary(false);
      } catch (err) {
        setPhase("idle");
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(msg);
      }
    },
    [projectId, token, category, maxMB, onUploadComplete]
  );

  const handleDelete = useCallback(async () => {
    if (!currentUpload) return;
    if (!confirm(`Delete "${currentUpload.original_file_name}"? This cannot be undone.`)) return;
    try {
      await deleteUpload(projectId, currentUpload.id, token);
      onUploadDeleted(currentUpload.id);
      setParsedData(null);
      setShowSummary(false);
      toast.success("File deleted");
    } catch {
      toast.error("Failed to delete file");
    }
  }, [projectId, currentUpload, token, onUploadDeleted]);

  const handleView = useCallback(async () => {
    if (!currentUpload) return;
    try {
      const { signed_url } = await getSignedUrl(projectId, currentUpload.id, token);
      window.open(signed_url, "_blank", "noopener");
    } catch {
      toast.error("Could not open file");
    }
  }, [projectId, currentUpload, token]);

  const handleReParse = useCallback(async () => {
    if (!currentUpload) return;
    try {
      await triggerParse(projectId, currentUpload.id, token);
      toast.success("Re-parse queued");
    } catch {
      toast.error("Could not queue re-parse");
    }
  }, [projectId, currentUpload, token]);

  const handleToggleSummary = useCallback(async () => {
    if (!currentUpload || currentUpload.parse_status !== "parsed") return;
    if (!showSummary && !parsedData) {
      setLoadingSummary(true);
      try {
        const res = await getParsedSummary(projectId, currentUpload.id, token);
        setParsedData(res.parsed);
      } catch {
        toast.error("Could not load summary");
      } finally {
        setLoadingSummary(false);
      }
    }
    setShowSummary((v) => !v);
  }, [currentUpload, showSummary, parsedData, projectId, token]);

  const phaseLabel = {
    initiating: "Preparing…",
    uploading: "Uploading…",
    confirming: "Finalizing…",
    done: "Done",
    idle: "",
  }[phase];

  const hasUpload = currentUpload && currentUpload.upload_status === "uploaded";

  return (
    <div className={`border rounded-lg p-4 bg-white shadow-sm ${category.required && !hasUpload ? "border-amber-300" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-800">{category.label}</h3>
            {category.required && (
              <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                Required
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{category.description}</p>
        </div>
        {hasUpload && (
          <div className="flex items-center gap-1 shrink-0">
            <UploadStatusBadge status={currentUpload.upload_status} />
            {currentUpload.parse_status !== "not_required" && (
              <ParseStatusBadge status={currentUpload.parse_status} />
            )}
          </div>
        )}
      </div>

      {category.helpText && !hasUpload && (
        <p className="text-xs text-slate-400 italic mb-3 leading-relaxed">{category.helpText}</p>
      )}

      {hasUpload ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded p-2">
            <span className="truncate flex-1 font-medium">{currentUpload.original_file_name}</span>
            <span className="text-slate-400 shrink-0">
              {new Date(currentUpload.created_at).toLocaleDateString()}
            </span>
          </div>

          {currentUpload.parse_error && (
            <div className="flex items-start gap-1 text-xs text-red-600 bg-red-50 rounded p-2">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{currentUpload.parse_error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleView}
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1"
            >
              <Eye className="w-3 h-3" /> View
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" /> Replace
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
            {currentUpload.parse_status === "failed" && (
              <button
                onClick={handleReParse}
                className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 border border-orange-200 rounded px-2 py-1"
              >
                <RefreshCw className="w-3 h-3" /> Retry Parse
              </button>
            )}
            {currentUpload.parse_status === "parsed" && (
              <button
                onClick={handleToggleSummary}
                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 border border-emerald-200 rounded px-2 py-1"
              >
                {showSummary ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showSummary ? "Hide Summary" : "View Summary"}
              </button>
            )}
          </div>

          {showSummary && (
            <div className="mt-3 border-t pt-3">
              {loadingSummary ? (
                <p className="text-xs text-slate-400">Loading summary…</p>
              ) : parsedData ? (
                <ParsedSummaryPreview summary={parsedData} />
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div>
          {isUploading ? (
            <div className="flex items-center gap-2 text-sm text-blue-600 py-2">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              {phaseLabel}
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-md px-3 py-2 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload File
            </button>
          )}
          <p className="text-xs text-slate-400 mt-1">
            {category.acceptedExtensions.join(", ")} · max {maxMB}MB
          </p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
