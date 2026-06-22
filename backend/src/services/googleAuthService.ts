/**
 * Google OAuth 2.0 service
 * Handles authorization URL generation, code exchange, token refresh,
 * and listing available Search Console + GA4 properties.
 */

import { encryptToken, decryptToken } from "../lib/tokenEncryption.js";
import { requireEnv } from "../lib/env.js";
import { logger } from "../lib/logger.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GSC_SITES_URL = "https://www.googleapis.com/webmasters/v3/sites";
const GA4_ACCOUNT_SUMMARIES_URL = "https://analyticsadmin.googleapis.com/v1beta/accountSummaries";

export const GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];
export const GA4_SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"];

export type IntegrationType = "search_console" | "google_analytics" | "google_business_profile";

export interface OAuthState {
  projectId: string;
  userId: string;
  integrationType: IntegrationType;
  nonce: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface StoredTokens {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  expiresAt: Date;
  scopes: string[];
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

function clientId(): string {
  return requireEnv(["GOOGLE_CLIENT_ID"]);
}

function clientSecret(): string {
  return requireEnv(["GOOGLE_CLIENT_SECRET"]);
}

function redirectUri(): string {
  return requireEnv(["GOOGLE_REDIRECT_URI"]);
}

// ── State encoding ────────────────────────────────────────────────────────────

export function encodeState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

export function decodeState(encoded: string): OAuthState {
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthState;
  } catch {
    throw new Error("Invalid OAuth state parameter");
  }
}

// ── Authorization URL ─────────────────────────────────────────────────────────

export function buildAuthUrl(integrationType: IntegrationType, state: string): string {
  const scopes =
    integrationType === "search_console"
      ? GSC_SCOPES
      : integrationType === "google_analytics"
      ? GA4_SCOPES
      : [];

  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ── Token exchange ────────────────────────────────────────────────────────────

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri(),
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Google token exchange failed: ${err.error_description ?? res.statusText}`);
  }

  return res.json() as Promise<TokenResponse>;
}

// ── Token refresh ─────────────────────────────────────────────────────────────

export async function refreshAccessToken(encryptedRefreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const refreshToken = decryptToken(encryptedRefreshToken);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Google token refresh failed: ${err.error_description ?? res.statusText}`);
  }

  const data = await res.json() as TokenResponse;
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

// ── Encrypt + store token response ───────────────────────────────────────────

export function storeTokens(tokens: TokenResponse): StoredTokens {
  const accessTokenEncrypted = encryptToken(tokens.access_token);
  const refreshTokenEncrypted = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const scopes = tokens.scope.split(" ").filter(Boolean);
  return { accessTokenEncrypted, refreshTokenEncrypted, expiresAt, scopes };
}

// ── Get a valid access token, refreshing if needed ───────────────────────────

export async function getValidAccessToken(integration: {
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
}): Promise<string> {
  if (!integration.access_token_encrypted) throw new Error("No access token stored");

  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
  const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 60_000;

  if (!isExpired) {
    return decryptToken(integration.access_token_encrypted);
  }

  if (!integration.refresh_token_encrypted) throw new Error("Token expired and no refresh token available");

  logger.info("Refreshing Google access token");
  const { accessToken } = await refreshAccessToken(integration.refresh_token_encrypted);
  return accessToken;
}

// ── Account email ─────────────────────────────────────────────────────────────

export async function getAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "";
  const data = await res.json() as { email?: string };
  return data.email ?? "";
}

// ── Search Console properties ─────────────────────────────────────────────────

export async function listGscProperties(accessToken: string): Promise<GscProperty[]> {
  const res = await fetch(GSC_SITES_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Failed to list GSC properties: ${err.error ?? res.statusText}`);
  }
  const data = await res.json() as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> };
  return (data.siteEntry ?? []).map(s => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }));
}

// ── GA4 properties ────────────────────────────────────────────────────────────

export async function listGa4Properties(accessToken: string): Promise<Ga4Property[]> {
  const res = await fetch(GA4_ACCOUNT_SUMMARIES_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Failed to list GA4 properties: ${err.error ?? res.statusText}`);
  }

  const data = await res.json() as {
    accountSummaries?: Array<{
      account: string;
      displayName: string;
      propertySummaries?: Array<{ property: string; displayName: string }>;
    }>;
  };

  const properties: Ga4Property[] = [];
  for (const account of data.accountSummaries ?? []) {
    const accountId = account.account.replace("accounts/", "");
    for (const prop of account.propertySummaries ?? []) {
      properties.push({
        propertyId: prop.property.replace("properties/", ""),
        propertyName: prop.displayName,
        accountId,
        accountName: account.displayName,
      });
    }
  }
  return properties;
}
