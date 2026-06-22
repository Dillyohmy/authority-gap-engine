import { useState } from "react";
import { CheckCircle2, Circle, Clock, Ban, SkipForward, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { dashboardApi } from "@/lib/dashboardApi";
import type { DashboardTask } from "@/lib/dashboardApi";

interface Props {
  tasks: DashboardTask[];
  projectId: string;
  planId?: string;
  onTaskUpdated?: (taskId: string, status: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  not_started: { label: "Not Started", icon: <Circle className="h-3.5 w-3.5" />, cls: "text-muted-foreground" },
  in_progress: { label: "In Progress", icon: <Clock className="h-3.5 w-3.5 text-blue-500" />, cls: "text-blue-600" },
  completed: { label: "Completed", icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, cls: "text-emerald-600" },
  blocked: { label: "Blocked", icon: <Ban className="h-3.5 w-3.5 text-red-400" />, cls: "text-red-500" },
  skipped: { label: "Skipped", icon: <SkipForward className="h-3.5 w-3.5 text-slate-400" />, cls: "text-muted-foreground" },
};

const PRIORITY_CLS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

const WINDOW_LABEL: Record<string, string> = {
  "30_days": "30 days",
  "60_days": "60 days",
  "90_days": "90 days",
  ongoing: "Ongoing",
};

function TaskRow({ task, projectId, onTaskUpdated }: { task: DashboardTask; projectId: string; onTaskUpdated?: (id: string, status: string) => void }) {
  const [status, setStatus] = useState(task.status);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updateStatus = async (newStatus: string) => {
    if (newStatus === status) return;
    setLoading(true);
    try {
      await dashboardApi.updateTaskStatus(projectId, task.id, newStatus);
      setStatus(newStatus);
      onTaskUpdated?.(task.id, newStatus);
    } catch {
      toast({ title: "Failed to update task", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;

  return (
    <div className={`rounded-lg border px-4 py-3 ${status === "completed" ? "opacity-60 bg-muted/30" : "bg-card"}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${PRIORITY_CLS[task.priority] ?? PRIORITY_CLS.medium}`}>
              {task.priority}
            </span>
            <span className="text-xs text-muted-foreground">{WINDOW_LABEL[task.due_window] ?? task.due_window}</span>
            {task.estimated_effort && (
              <span className="text-xs text-muted-foreground">· {task.estimated_effort}</span>
            )}
          </div>
          <p className={`text-sm font-medium ${status === "completed" ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </p>
          {task.description && task.description !== task.title && (
            <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className={`h-7 px-2 text-xs ${cfg.cls}`} disabled={loading}>
              {cfg.label} <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <DropdownMenuItem key={key} onClick={() => updateStatus(key)}>
                {val.icon}
                <span className="ml-2">{val.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function GrowthPlanTaskList({ tasks, projectId, onTaskUpdated }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No growth plan tasks for this phase yet. Generate a Personal Authority Growth Plan to unlock your action roadmap.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} projectId={projectId} onTaskUpdated={onTaskUpdated} />
      ))}
    </div>
  );
}
