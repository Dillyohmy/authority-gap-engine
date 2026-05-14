import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Shield,
  Search,
  BarChart3,
  Activity,
  Globe,
  FileText,
  Cpu,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { trackEvent } from "@/lib/tracking";
import { getScanStatus, getScanResult } from "@/lib/scanClient";
import ScanError from "@/components/ScanError";
import type { ScanJobStatus } from "@/types/scanReport";

const STATUS_STEPS: Record<
  string,
  { label: string; detail: string; icon: React.ElementType }
> = {
  queued: {
    label: "Preparing scan",
    detail: "Your scan is queued and will begin shortly.",
    icon: Activity,
  },
  fetching: {
    label: "Fetching live site data",
    detail: "Retrieving page content, structure, and metadata.",
    icon: Globe,
  },
  extracting: {
    label: "Extracting page structure",
    detail: "Parsing content hierarchy, navigation, and conversion elements.",
    icon: FileText,
  },
  analyzing: {
    label: "Analyzing visibility and conversion signals",
    detail:
      "Evaluating authority signals, keyword structure, and patient pathways.",
    icon: Search,
  },
  scoring: {
    label: "Calculating score and opportunity range",
    detail:
      "Modeling demand capture, conversion efficiency, and revenue potential.",
    icon: BarChart3,
  },
  generating_report: {
    label: "Finalizing diagnostic report",
    detail: "Composing structured intelligence and priority actions.",
    icon: Cpu,
  },
  completed: {
    label: "Authority Gap Score ready",
    detail: "Your comprehensive authority assessment is ready.",
    icon: Shield,
  },
};

const STATUS_ORDER: ScanJobStatus[] = [
  "queued",
  "fetching",
  "extracting",
  "analyzing",
  "scoring",
  "generating_report",
  "completed",
];

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_CONSECUTIVE_ERRORS = 8;

const ScanLoading = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const jobId = params.get("jobId") || "";

  const [currentStatus, setCurrentStatus] =
    useState<ScanJobStatus>("queued");
  const [error, setError] = useState<string | null>(null);

  const pollStartRef = useRef(Date.now());
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatingRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);

  const stepIndex = Math.max(STATUS_ORDER.indexOf(currentStatus), 0);
  const totalSteps = STATUS_ORDER.length;
  const progress = Math.min(((stepIndex + 1) / totalSteps) * 100, 100);

  const step = STATUS_STEPS[currentStatus] || STATUS_STEPS.queued;
  const CurrentIcon = step.icon;

  const clearPollTimer = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const goToResults = useCallback(() => {
    if (navigatingRef.current) return;

    navigatingRef.current = true;
    trackEvent("scan_completed", undefined, { job_id: jobId });

    setCurrentStatus("completed");

    setTimeout(() => {
      navigate(`/results?jobId=${encodeURIComponent(jobId)}`, {
        replace: true,
      });
    }, 700);
  }, [jobId, navigate]);

  const poll = useCallback(async () => {
    if (!jobId) {
      setError("No scan job ID found. Please start a new scan.");
      return;
    }

    if (navigatingRef.current) return;

    const elapsed = Date.now() - pollStartRef.current;

    if (elapsed > POLL_TIMEOUT_MS) {
      try {
        await getScanResult(jobId);
        goToResults();
        return;
      } catch {
        setError(
          "The scan is taking longer than expected. Please start a new scan."
        );
        return;
      }
    }

    try {
      const status = await getScanStatus(jobId);
      consecutiveErrorsRef.current = 0;

      if (status.status === "failed") {
        setError(
          status.error || "The scan could not be completed. Please try again."
        );
        return;
      }

      if (status.status === "completed") {
        goToResults();
        return;
      }

      if (STATUS_STEPS[status.status]) {
        setCurrentStatus(status.status);
      }

      pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    } catch (err) {
      consecutiveErrorsRef.current += 1;

      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not reach the analysis server. Please try again."
        );
        return;
      }

      pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }
  }, [jobId, goToResults]);

  useEffect(() => {
    pollStartRef.current = Date.now();
    consecutiveErrorsRef.current = 0;
    navigatingRef.current = false;
    clearPollTimer();
    poll();

    return () => {
      clearPollTimer();
    };
  }, [poll]);

  if (error) {
    return (
      <ScanError
        message={error}
        onRetry={() => {
          setError(null);
          setCurrentStatus("queued");
          pollStartRef.current = Date.now();
          consecutiveErrorsRef.current = 0;
          navigatingRef.current = false;
          clearPollTimer();
          poll();
        }}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-secondary px-4">
      <Card className="shadow-elevated border-0 rounded-xl max-w-lg w-full overflow-hidden">
        <div className="bg-ihd-dark-green px-6 py-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/50 font-semibold">
            Authority Gap Engine™
          </p>
          <p className="text-[14px] font-extrabold text-primary-foreground mt-0.5">
            Live Diagnostic Analysis
          </p>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-8">
          <div className="flex justify-center">
            <motion.div
              className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStatus}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                >
                  <CurrentIcon className="h-9 w-9 text-primary" />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

          <div className="text-center space-y-2 min-h-[56px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStatus}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-[14px] font-bold text-foreground">
                  {step.label}
                </p>
                <p className="text-[12px] text-muted-foreground/60 mt-1 leading-relaxed">
                  {step.detail}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="space-y-2">
            <div
              className="w-full bg-border/50 rounded-full h-2.5 overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Scan progress"
            >
              <motion.div
                className="h-full bg-primary rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/50 font-semibold">
                Step {stepIndex + 1} of {totalSteps}
              </span>
              <span className="text-[10px] text-muted-foreground/50 font-semibold">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          <div className="flex justify-center gap-2">
            {STATUS_ORDER.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i <= stepIndex ? "w-6 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScanLoading;