import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

interface ScanErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

const ScanError = ({
  title = "Scan Could Not Be Completed",
  message = "Something went wrong while analyzing this website. This may be due to the site being unreachable, a timeout, or an unexpected error.",
  onRetry,
  retryLabel = "Retry Scan",
}: ScanErrorProps) => (
  <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-secondary px-4">
    <Card className="shadow-elevated border-0 rounded-xl max-w-lg w-full overflow-hidden">
      <div className="bg-destructive/90 px-6 py-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/50 font-semibold">
          Authority Gap Engine™
        </p>
        <p className="text-[14px] font-extrabold text-primary-foreground mt-0.5">
          Analysis Error
        </p>
      </div>
      <CardContent className="p-6 sm:p-8 space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-[16px] font-extrabold text-foreground">{title}</h2>
          <p className="text-[13px] text-muted-foreground/70 leading-relaxed max-w-sm mx-auto">
            {message}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {onRetry && (
            <Button onClick={onRetry} className="gap-2 rounded-lg font-bold text-[13px] px-6 h-11">
              <RotateCcw className="h-4 w-4" />
              {retryLabel}
            </Button>
          )}
          <Link to="/scan">
            <Button variant="outline" className="gap-2 rounded-lg font-bold text-[13px] px-6 h-11 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              <ArrowLeft className="h-4 w-4" />
              New Scan
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default ScanError;
