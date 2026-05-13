import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { trackEventApi } from "@/lib/scanClient";

/**
 * Track an analytics event.
 * Attempts to send via the backend API first.
 * Falls back to direct Supabase insert if the API is unavailable.
 */
export async function trackEvent(
  eventType: string,
  websiteUrl?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    // Try backend API first
    await trackEventApi(eventType, websiteUrl, metadata);
  } catch {
    // Fallback to direct Supabase insert
    try {
      await supabase.from("scan_events").insert([{
        event_type: eventType,
        website_url: websiteUrl ?? null,
        metadata_json: (metadata ?? {}) as Json,
      }]);
    } catch {
      // Silent — tracking must never block UX
    }
  }
}
