/**
 * Authority Gap Engine™ — Scan API Client
 *
 * Clean abstraction over the external backend endpoints.
 * When VITE_API_BASE_URL is missing, falls back to mock responses
 * so the full UI flow works in Lovable preview.
 */

import { apiFetch } from "./api";
import {
  IS_MOCK_MODE,
  mockStartScan,
  mockGetScanStatus,
  mockGetScanResult,
} from "./mockScanData";
import type {
  StartScanResponse,
  ScanJobStatusResponse,
  ScanReport,
} from "@/types/scanReport";

export interface StartScanInput {
  website_url: string;
  clinic_type: string;
  location: string;
  monthly_patient_value?: number;
  monthly_traffic?: number;
}

export interface LeadSubmission {
  name?: string;
  email: string;
  wants_strategy_review: boolean;
  email_opt_in?: boolean;
  website_url: string;
  clinic_type: string;
  location: string;
  authority_gap_score?: number;
  estimated_revenue_low?: number;
  estimated_revenue_high?: number;
}

/** POST /api/scan/start — Kick off a live scan job */
export function startScan(input: StartScanInput): Promise<StartScanResponse> {
  if (IS_MOCK_MODE) {
    const job_id = mockStartScan(input.website_url, input.clinic_type, input.location);
    return Promise.resolve({ job_id });
  }
  return apiFetch<StartScanResponse>("/api/scan/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /api/scan/status/:jobId — Poll current scan job status */
export function getScanStatus(jobId: string): Promise<ScanJobStatusResponse> {
  if (IS_MOCK_MODE) {
    const result = mockGetScanStatus(jobId);
    return Promise.resolve({ job_id: jobId, ...result });
  }
  return apiFetch<ScanJobStatusResponse>(`/api/scan/status/${jobId}`);
}

/** GET /api/scan/result/:jobId — Fetch completed scan report */
export function getScanResult(jobId: string): Promise<ScanReport> {
  if (IS_MOCK_MODE) {
    return Promise.resolve(mockGetScanResult(jobId));
  }
  return apiFetch<ScanReport>(`/api/scan/result/${jobId}`);
}

/** POST /api/lead — Submit lead capture data */
export function submitLead(data: LeadSubmission): Promise<{ success: boolean }> {
  if (IS_MOCK_MODE) {
    return Promise.resolve({ success: true });
  }
  return apiFetch<{ success: boolean }>("/api/lead", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** POST /api/event — Track analytics event */
export function trackEventApi(
  eventType: string,
  websiteUrl?: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean }> {
  if (IS_MOCK_MODE) {
    if (import.meta.env.DEV) {
      console.log(`[mock] trackEvent: ${eventType}`, websiteUrl, metadata);
    }
    return Promise.resolve({ success: true });
  }
  return apiFetch<{ success: boolean }>("/api/event", {
    method: "POST",
    body: JSON.stringify({
      event_type: eventType,
      website_url: websiteUrl ?? null,
      metadata: metadata ?? {},
    }),
  });
}
