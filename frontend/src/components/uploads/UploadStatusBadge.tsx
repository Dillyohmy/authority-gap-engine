import type { UploadStatus } from "@/lib/uploadsApi";

const CONFIG: Record<UploadStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  uploaded: { label: "Uploaded", className: "bg-green-100 text-green-800 border-green-200" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 border-red-200" },
  deleted: { label: "Deleted", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

export function UploadStatusBadge({ status }: { status: UploadStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
