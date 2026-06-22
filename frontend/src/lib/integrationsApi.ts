import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...headers, ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as Record<string, string>).error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntegrationType = "search_console" | "google_analytics" | "google_business_profile";
export type IntegrationStatus = "not_connected" | "connected" | "expired" | "revoked" | "error";

export interface ProjectIntegration {
  id: string;
  integration_type: IntegrationType;
  status: IntegrationStatus;
  external_account_email: string | null;
  property_id: string | null;
  property_name: string | null;
  site_url: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface GscProperty {
  siteUrl: string;
  permissionLevel: string;
}

export interface Ga4Property {
  propertyId: string;
  propertyName: string;
  accountId: string;
  accountName: string;
}

export interface SyncStatus {
  integrationStatus: IntegrationStatus;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  latestJob: {
    id: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
    created_at: string;
  } | null;
}

export interface GscSummary {
  dateRangeStart: string;
  dateRangeEnd: string;
  totals: { clicks: number; impressions: number; avgCtr: number; avgPosition: number };
  topQueriesByClicks: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  topQueriesByImpressions: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  highImpLowCtrQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  nearPageOneQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  zeroClickQueries: Array<{ query: string; impressions: number }>;
  topPagesByClicks: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
  localIntentQueries: Array<{ query: string; clicks: number; impressions: number }>;
  serviceKeywordQueries: Array<{ query: string; clicks: number; impressions: number }>;
}

export interface Ga4Summary {
  dateRangeStart: string;
  dateRangeEnd: string;
  totals: { sessions: number; users: number; engagedSessions: number; avgEngagementRate: number };
  topLandingPages: Array<{ page: string; sessions: number; users: number; engagementRate: number; keyEvents: number }>;
  topChannels: Array<{ channel: string; sessions: number; users: number; engagementRate: number }>;
  topCities: Array<{ city: string; region: string; sessions: number; users: number }>;
  deviceBreakdown: Array<{ deviceCategory: string; sessions: number; users: number }>;
  topEvents: Array<{ eventName: string; eventCount: number }>;
  pagesWithTrafficButWeakConversions: Array<{ page: string; sessions: number; keyEvents: number }>;
}

// ── API client ────────────────────────────────────────────────────────────────

export const integrationsApi = {
  list: (projectId: string): Promise<{ integrations: ProjectIntegration[] }> =>
    apiFetch(`/api/projects/${projectId}/integrations`),

  connect: (projectId: string, integrationType: IntegrationType): Promise<{ url: string }> =>
    apiFetch(`/api/projects/${projectId}/integrations/google/connect`, {
      method: "POST",
      body: JSON.stringify({ integrationType }),
    }),

  disconnect: (projectId: string, integrationId: string): Promise<{ ok: boolean }> =>
    apiFetch(`/api/projects/${projectId}/integrations/${integrationId}/disconnect`, { method: "POST" }),

  listProperties: (projectId: string, integrationId: string): Promise<{ properties: GscProperty[] | Ga4Property[] }> =>
    apiFetch(`/api/projects/${projectId}/integrations/${integrationId}/properties`),

  selectProperty: (
    projectId: string,
    integrationId: string,
    payload: { propertyId?: string; propertyName?: string; siteUrl?: string }
  ): Promise<{ ok: boolean }> =>
    apiFetch(`/api/projects/${projectId}/integrations/${integrationId}/select-property`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  sync: (projectId: string, integrationId: string, daysBack = 28): Promise<{ ok: boolean; jobId: string }> =>
    apiFetch(`/api/projects/${projectId}/integrations/${integrationId}/sync`, {
      method: "POST",
      body: JSON.stringify({ daysBack }),
    }),

  syncStatus: (projectId: string, integrationId: string): Promise<SyncStatus> =>
    apiFetch(`/api/projects/${projectId}/integrations/${integrationId}/sync-status`),

  summary: (projectId: string, integrationId: string): Promise<{ summary: GscSummary | Ga4Summary | null }> =>
    apiFetch(`/api/projects/${projectId}/integrations/${integrationId}/summary`),
};
