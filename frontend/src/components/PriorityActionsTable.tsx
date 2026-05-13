import { Card } from "@/components/ui/card";
import SeverityBadge from "./SeverityBadge";
import type { ScanFinding } from "@/types/scanReport";
import { AlertTriangle, ArrowRight } from "lucide-react";

interface PriorityActionsTableProps {
  findings: ScanFinding[];
  title?: string;
}

const PriorityActionsTable = ({ findings, title = "Priority Actions" }: PriorityActionsTableProps) => (
  <Card className="shadow-elevated overflow-hidden border-0 rounded-xl">
    <div className="bg-ihd-dark-green px-5 sm:px-6 py-4 flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
        <AlertTriangle className="h-4 w-4 text-primary-foreground" />
      </div>
      <h3 className="text-[14px] font-extrabold text-primary-foreground tracking-wide">{title}</h3>
    </div>
    <div className="divide-y">
      {findings.map((f, i) => (
        <div key={f.id} className="px-5 sm:px-6 py-4 sm:py-5 bg-card hover:bg-secondary/20 transition-colors">
          <div className="flex items-start gap-3.5">
            <span className="h-7 w-7 rounded-full bg-ihd-dark-green text-primary-foreground text-[11px] font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[13px] font-bold text-foreground">{f.label}</span>
                <SeverityBadge severity={f.severity} />
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="px-5 sm:px-6 py-3.5 bg-secondary/30 border-t">
      <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
        <ArrowRight className="h-3 w-3" />
        <span className="font-semibold">Addressing these findings first will produce the highest impact on overall authority score.</span>
      </div>
    </div>
  </Card>
);

export default PriorityActionsTable;
