/**
 * Authority Gap Engine™ Scan API Client
 *
 * Clean abstraction over backend endpoints.
 * Uses mock responses when mock mode is enabled.
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

function normalizeWebsiteUrl(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

/**
 * POST /api/scan/start
 * Kick off a live scan job.
 */
export function startScan(input: StartScanInput): Promise<StartScanResponse> {
  const payload: StartScanInput = {
    website_url: normalizeWebsiteUrl(input.website_url),
    clinic_type: input.clinic_type.trim(),
    location: input.location.trim(),
  };

  if (typeof input.monthly_patient_value === "number") {
    payload.monthly_patient_value = input.monthly_patient_value;
  }

  if (typeof input.monthly_traffic === "number") {
    payload.monthly_traffic = input.monthly_traffic;
  }

  if (IS_MOCK_MODE) {
    const job_id = mockStartScan(
      payload.website_url,
      payload.clinic_type,
      payload.location
    );

    return Promise.resolve({ job_id });
  }

  return apiFetch<StartScanResponse>("/api/scan/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * GET /api/scan/status/:jobId
 * Poll current scan job status.
 */
export function getScanStatus(jobId: string): Promise<ScanJobStatusResponse> {
  if (IS_MOCK_MODE) {
    const result = mockGetScanStatus(jobId);

    return Promise.resolve({
      job_id: jobId,
      ...result,
    });
  }

  return apiFetch<ScanJobStatusResponse>(`/api/scan/status/${jobId}`);
}

/**
 * GET /api/scan/result/:jobId
 * Fetch completed scan report.
 */
export function getScanResult(jobId: string): Promise<ScanReport> {
  if (IS_MOCK_MODE) {
    return Promise.resolve(mockGetScanResult(jobId));
  }

  return apiFetch<ScanReport>(`/api/scan/result/${jobId}`);
}

/**
 * POST /api/lead
 * Submit lead capture data.
 */
export function submitLead(data: LeadSubmission): Promise<{ success: boolean }> {
  const payload: LeadSubmission = {
    ...data,
    website_url: normalizeWebsiteUrl(data.website_url),
    clinic_type: data.clinic_type.trim(),
    location: data.location.trim(),
    email: data.email.trim(),
    name: data.name?.trim(),
  };

  if (IS_MOCK_MODE) {
    return Promise.resolve({ success: true });
  }

  return apiFetch<{ success: boolean }>("/api/lead", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * POST /api/event
 * Track analytics event.
 */
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
      website_url: websiteUrl ? normalizeWebsiteUrl(websiteUrl) : null,
      metadata: metadata ?? {},
    }),
  });
}