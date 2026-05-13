import * as React from "react";
import { Badge } from "@/components/ui/badge";

interface SeverityBadgeProps {
  severity: "high" | "medium" | "low";
}

const SeverityBadge = React.forwardRef<HTMLDivElement, SeverityBadgeProps>(
  ({ severity }, ref) => {
    const config = {
      high: { bg: "bg-destructive/10 border-destructive/25", text: "text-destructive", dot: "bg-destructive", label: "Critical" },
      medium: { bg: "bg-warning/10 border-warning/25", text: "text-warning", dot: "bg-warning", label: "Medium" },
      low: { bg: "bg-success/10 border-success/25", text: "text-success", dot: "bg-success", label: "Low" },
    };
    const c = config[severity];

    return (
      <div ref={ref}>
        <Badge variant="outline" className={`text-[10px] font-extrabold px-2.5 py-0.5 gap-1.5 uppercase tracking-[0.08em] ${c.bg} ${c.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
          {c.label}
        </Badge>
      </div>
    );
  }
);
SeverityBadge.displayName = "SeverityBadge";

export default SeverityBadge;
