import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NextBestAction } from "@/lib/dashboardApi";

interface Props {
  action: NextBestAction;
}

export function NextBestActionCard({ action }: Props) {
  const navigate = useNavigate();

  const priorityConfig = {
    critical: { bg: "bg-red-50 border-red-200", icon: <AlertTriangle className="h-4 w-4 text-red-500" />, badge: "text-red-700 bg-red-100" },
    high: { bg: "bg-amber-50 border-amber-200", icon: <Zap className="h-4 w-4 text-amber-500" />, badge: "text-amber-700 bg-amber-100" },
    medium: { bg: "bg-blue-50 border-blue-200", icon: <Info className="h-4 w-4 text-blue-500" />, badge: "text-blue-700 bg-blue-100" },
  };

  const cfg = priorityConfig[action.priority];

  return (
    <div className={`rounded-xl border px-5 py-4 flex items-start gap-4 ${cfg.bg}`}>
      <div className="mt-0.5">{cfg.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${cfg.badge}`}>
            Next Best Action
          </span>
        </div>
        <h3 className="font-semibold text-sm">{action.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => navigate(action.href)} className="shrink-0 self-center">
        Go <ArrowRight className="h-3.5 w-3.5 ml-1" />
      </Button>
    </div>
  );
}
