import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.js";

const SUPABASE_URL = requireEnv([
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
]);

const SUPABASE_SERVICE_KEY = requireEnv([
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

/**
 * Server-side Supabase client using service role key.
 * Full access, no RLS restrictions.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  realtime: {
    transport: WebSocket as any,
  },
});

/**
 * Backward compatible export for route files that import { db }.
 */
export const db = supabase;