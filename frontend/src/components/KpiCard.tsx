import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: "default" | "success" | "warning" | "critical";
  footnote?: string;
}

const colorMap = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
};

const iconBgMap = {
  default: "bg-accent",
  success: "bg-success/10",
  warning: "bg-warning/10",
  critical: "bg-destructive/10",
};

const iconColorMap = {
  default: "text-accent-foreground",
  success: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
};

const KpiCard = ({ label, value, subtitle, icon, color = "default", footnote }: KpiCardProps) => (
  <Card className="shadow-elevated border-0 rounded-xl">
    <CardContent className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 min-w-0">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em]">{label}</p>
          <p className={`text-[20px] sm:text-[22px] font-extrabold leading-tight ${colorMap[color]} truncate`}>{value}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground/70 leading-snug">{subtitle}</p>}
          {footnote && <p className="text-[10px] text-muted-foreground/50 italic mt-1">{footnote}</p>}
        </div>
        {icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBgMap[color]} ${iconColorMap[color]} flex-shrink-0`}>
            {icon}
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

export default KpiCard;
