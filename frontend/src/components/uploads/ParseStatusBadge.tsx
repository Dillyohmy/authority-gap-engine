import type { ParseStatus } from "@/lib/uploadsApi";

const CONFIG: Record<ParseStatus, { label: string; className: string }> = {
  not_required: { label: "N/A", className: "bg-gray-100 text-gray-500 border-gray-200" },
  pending: { label: "Queued", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  processing: { label: "Parsing…", className: "bg-blue-100 text-blue-800 border-blue-200" },
  parsed: { label: "Parsed", className: "bg-green-100 text-green-800 border-green-200" },
  failed: { label: "Parse Failed", className: "bg-red-100 text-red-800 border-red-200" },
};

export function ParseStatusBadge({ status }: { status: ParseStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.not_required;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
