import * as React from "react";
import { AlertCircle, AlertTriangle, Zap } from "lucide-react";

interface SeverityBadgeProps {
  severity: "high" | "medium" | "low";
  size?: "sm" | "md";
}

const CONFIG = {
  high: {
    bg: "bg-[#FEF2F2] border-[#FECACA]",
    text: "text-[#DC2626]",
    Icon: AlertCircle,
    label: "Critical",
  },
  medium: {
    bg: "bg-[#FFFBEB] border-[#FDE68A]",
    text: "text-[#D97706]",
    Icon: AlertTriangle,
    label: "Warning",
  },
  low: {
    bg: "bg-[#F0FDF4] border-[#BBF7D0]",
    text: "text-[#16A34A]",
    Icon: Zap,
    label: "Quick Win",
  },
} as const;

const SeverityBadge = React.forwardRef<HTMLSpanElement, SeverityBadgeProps>(
  ({ severity, size = "sm" }, ref) => {
    const c = CONFIG[severity];
    const Icon = c.Icon;
    const isSmall = size === "sm";

    return (
      <span
        ref={ref}
        className={`inline-flex items-center gap-1 font-bold border rounded-full uppercase tracking-[0.06em] whitespace-nowrap ${c.bg} ${c.text} ${
          isSmall ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"
        } ${severity === "high" ? "badge-pulse" : ""}`}
      >
        <Icon className={`shrink-0 ${isSmall ? "h-2.5 w-2.5" : "h-3 w-3"}`} />
        {c.label}
      </span>
    );
  }
);
SeverityBadge.displayName = "SeverityBadge";

export default SeverityBadge;
