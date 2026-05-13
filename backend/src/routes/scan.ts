import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { Queue } from "bullmq";
import { redis, REDIS_ENABLED } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import type { ScanFinding, ScanJob, ScanReport, StartScanInput } from "../types/scanReport.js";

let scanQueue: Queue | undefined;

function getScanQueue() {
  scanQueue ??= new Queue("scan-jobs", { connection: redis });
  return scanQueue;
}

/** In-memory job store — replace with DB persistence in production */
const jobs = new Map<string, ScanJob>();
const results = new Map<string, ScanReport>();

const StartScanSchema = z.object({
  website_url: z.string().url(),
  clinic_type: z.string().min(1),
  location: z.string().min(1),
  monthly_patient_value: z.number().optional(),
  monthly_traffic: z.number().optional(),
});

export const scanRouter = Router();

/**
 * POST /api/scan/start
 * Validates input, creates a job, enqueues it for async processing.
 * Returns: { job_id: string }
 */
scanRouter.post("/start", async (req, res, next) => {
  try {
    const input = StartScanSchema.parse(req.body);
    const jobId = uuidv4();

    const job: ScanJob = {
      id: jobId,
      input,
      status: "queued",
      created_at: new Date(),
      updated_at: new Date(),
    };

    jobs.set(jobId, job);

    if (!REDIS_ENABLED) {
      const report = createLocalDevReport(jobId, input);
      const completedJob: ScanJob = {
        ...job,
        status: "completed",
        result: report,
        updated_at: new Date(),
      };

      jobs.set(jobId, completedJob);
      results.set(jobId, report);

      logger.info({ jobId }, "Redis disabled; using in-memory local scan result");
      return res.json({ job_id: jobId });
    }

    try {
      // Store in Redis for worker access
      await redis.set(`scan:job:${jobId}`, JSON.stringify(job), "EX", 3600);

      // Enqueue for background processing
      await getScanQueue().add("process-scan", { jobId, input }, {
        jobId,
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
      });

      logger.info({ jobId, url: input.website_url }, "Scan job created");
    } catch (err) {
      const report = createLocalDevReport(jobId, input);
      const completedJob: ScanJob = {
        ...job,
        status: "completed",
        result: report,
        updated_at: new Date(),
      };

      jobs.set(jobId, completedJob);
      results.set(jobId, report);

      logger.warn({ jobId }, "Redis unavailable; using in-memory local scan result");
    }

    res.json({ job_id: jobId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    next(err);
  }
});

/**
 * GET /api/scan/status/:jobId
 * Returns: { job_id, status, error? }
 */
scanRouter.get("/status/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const localJob = jobs.get(jobId);

  if (localJob) {
    return res.json({
      job_id: localJob.id,
      status: localJob.status,
      ...(localJob.error ? { error: localJob.error } : {}),
    });
  }

  if (!REDIS_ENABLED) {
    return res.status(404).json({ error: "Job not found. Local in-memory jobs are cleared when the backend restarts." });
  }

  try {
    // Check Redis first (worker updates status there)
    const raw = await redis.get(`scan:job:${jobId}`);
    if (!raw) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job: ScanJob = JSON.parse(raw);
    res.json({
      job_id: job.id,
      status: job.status,
      ...(job.error ? { error: job.error } : {}),
    });
  } catch (err) {
    logger.warn({ err, jobId }, "Redis unavailable while checking scan status");
    res.status(503).json({ error: "Scan service is unavailable because Redis is not running." });
  }
});

/**
 * GET /api/scan/result/:jobId
 * Returns: ScanReport (full report JSON)
 */
scanRouter.get("/result/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const localResult = results.get(jobId) || jobs.get(jobId)?.result;

  if (localResult) {
    return res.json(localResult);
  }

  if (!REDIS_ENABLED) {
    return res.status(404).json({ error: "Result not found. Local in-memory results are cleared when the backend restarts." });
  }

  try {
    const raw = await redis.get(`scan:result:${jobId}`);
    if (!raw) {
      return res.status(404).json({ error: "Result not found or scan not complete" });
    }

    const report: ScanReport = JSON.parse(raw);
    res.json(report);
  } catch (err) {
    logger.warn({ err, jobId }, "Redis unavailable while fetching scan result");
    res.status(503).json({ error: "Scan service is unavailable because Redis is not running." });
  }
});

function createLocalDevReport(scanId: string, input: StartScanInput): ScanReport {
  const visibilityFindings: ScanFinding[] = [
    {
      id: "v1",
      label: "Local search structure needs refinement",
      severity: "medium",
      description: `${input.website_url} should strengthen location-specific service content for ${input.clinic_type} searches in ${input.location}.`,
      impact: "Improves relevance for high-intent local searches.",
    },
    {
      id: "v2",
      label: "Structured data opportunity",
      severity: "medium",
      description: "Medical and local business schema can help search engines interpret the practice more clearly.",
      impact: "Improves eligibility for richer search presentation.",
    },
  ];

  const conversionFindings: ScanFinding[] = [
    {
      id: "c1",
      label: "Conversion path can be clearer",
      severity: "high",
      description: "Primary calls-to-action should be visible across service and mobile views.",
      impact: "Reduces friction for prospective patients ready to book or call.",
    },
    {
      id: "c2",
      label: "Trust proof should be more prominent",
      severity: "medium",
      description: "Reviews, credentials, outcomes, and patient reassurance elements should appear near decision points.",
      impact: "Improves confidence before a visitor submits a form.",
    },
  ];

  return {
    scan_id: scanId,
    input: {
      website_url: input.website_url,
      clinic_type: input.clinic_type,
      location: input.location,
    },
    scores: {
      authority_gap_score: 52,
      visibility_score: 21,
      conversion_score: 22,
      opportunity_score: 9,
      confidence_level: "local-dev",
    },
    estimated_revenue_low: 8000,
    estimated_revenue_high: 24000,
    executive_summary: `${input.website_url} shows a moderate authority gap across search visibility and conversion readiness. This local development result is generated because Redis is not running, so the full worker pipeline was skipped.`,
    visibility: {
      summary: "Visibility is constrained by local content depth and structured data opportunities.",
      findings: visibilityFindings,
      system_insight: "The main visibility constraint is discoverability for local, service-specific intent.",
      strategic_implication: "Improving local relevance can reduce reliance on referrals and paid traffic.",
      recommended_directions: [
        "Create location-specific service pages",
        "Add LocalBusiness and medical schema",
        "Expand service page content around patient intent",
      ],
    },
    conversion: {
      summary: "Conversion readiness can improve through clearer calls-to-action and stronger trust proof.",
      findings: conversionFindings,
      system_insight: "Visitors need a shorter path from interest to booking or contact.",
      strategic_implication: "Traffic gains will underperform unless conversion paths are strengthened.",
      recommended_directions: [
        "Add persistent call and booking actions on mobile",
        "Place reviews and credentials near forms",
        "Clarify next steps on every service page",
      ],
    },
    opportunity: {
      summary: "Revenue opportunity exists if visibility and conversion improvements are implemented together.",
      findings: [
        {
          id: "o1",
          label: "Compounding visibility and conversion lift",
          severity: "medium",
          description: "The largest gains come from pairing search improvements with better patient capture.",
          impact: "Creates a more reliable acquisition path from search to booked appointment.",
        },
      ],
      system_insight: "The opportunity range is directional for local development only.",
      strategic_implication: "Once Redis is running, the live scan worker can produce a full crawl-based report.",
      recommended_directions: [
        "Start Redis for live worker-backed scans",
        "Validate high-intent local keywords",
        "Track form and call conversions by source",
      ],
      model_inputs: [
        "Local development fallback",
        "Redis unavailable",
        "Directional benchmark assumptions",
      ],
      confidence_level: "local-dev",
    },
    top_fixes: [
      conversionFindings[0],
      visibilityFindings[0],
      conversionFindings[1],
    ],
    methodology:
      "This report was generated by the backend local development fallback because Redis is not running. It preserves the frontend workflow but does not replace the full live crawl and worker analysis.",
  };
}
