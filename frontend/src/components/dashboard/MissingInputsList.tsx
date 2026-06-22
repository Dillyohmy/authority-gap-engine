import { useNavigate } from "react-router-dom";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DashboardMissingInput } from "@/lib/dashboardApi";

interface Props {
  items: DashboardMissingInput[];
}

export function MissingInputsList({ items }: Props) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No missing inputs for this phase.
      </div>
    );
  }

  const reqColor = (r: string) =>
    r === "required" ? "destructive" : r === "recommended" ? "secondary" : "outline";

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border bg-muted/20 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{item.name}</span>
              <Badge variant={reqColor(item.required_or_optional) as "destructive" | "secondary" | "outline"} className="text-xs">
                {item.required_or_optional}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{item.why_it_matters}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{item.recommended_format}</p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 text-xs h-7 px-2.5" onClick={() => navigate(item.action_href)}>
            <Plus className="h-3 w-3 mr-1" />
            {item.action_label}
          </Button>
        </div>
      ))}
    </div>
  );
}
