import { URL } from "url";

// Block private/internal addresses and non-HTTP protocols
const BLOCKED_HOSTNAMES = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)$/i;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function validateCompetitorUrl(raw: string): { valid: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { valid: false, reason: "Only HTTP and HTTPS URLs are allowed" };
  }

  if (BLOCKED_HOSTNAMES.test(parsed.hostname)) {
    return { valid: false, reason: "Private or internal addresses are not allowed" };
  }

  return { valid: true };
}
