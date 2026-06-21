import type { ParsedSummary } from "@/lib/uploadsApi";

interface Props {
  summary: ParsedSummary;
}

function SummaryTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows || rows.length === 0) return null;
  const keys = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100">
            {keys.map((k) => (
              <th key={k} className="px-2 py-1 text-left font-medium text-slate-600 border border-slate-200 capitalize">
                {k.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row, i) => (
            <tr key={i} className="even:bg-slate-50">
              {keys.map((k) => (
                <td key={k} className="px-2 py-1 border border-slate-200 text-slate-700 max-w-[200px] truncate">
                  {String(row[k] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-3">
      <p className="text-xs text-slate-500 mb-1">{label.replace(/_/g, " ")}</p>
      <p className="text-sm font-semibold text-slate-800">{String(value ?? "—")}</p>
    </div>
  );
}

export function ParsedSummaryPreview({ summary }: Props) {
  const s = summary.summary_json ?? {};

  const topLevelStats: [string, unknown][] = Object.entries(s).filter(
    ([, v]) => typeof v === "number" || (typeof v === "string" && !v.startsWith("["))
  );

  const tableSections: [string, Record<string, unknown>[]][] = Object.entries(s)
    .filter(([, v]) => Array.isArray(v) && (v as unknown[]).length > 0)
    .slice(0, 3) as [string, Record<string, unknown>[]][];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>{summary.row_count.toLocaleString()} rows</span>
        <span>·</span>
        <span>{summary.column_headers.length} columns</span>
      </div>

      {topLevelStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {topLevelStats.slice(0, 8).map(([k, v]) => (
            <StatCard key={k} label={k} value={typeof v === "number" ? v.toLocaleString() : v} />
          ))}
        </div>
      )}

      {tableSections.map(([key, rows]) => (
        <div key={key}>
          <p className="text-xs font-medium text-slate-600 mb-1 capitalize">
            {key.replace(/_/g, " ")}
          </p>
          <SummaryTable rows={rows} />
        </div>
      ))}
    </div>
  );
}
