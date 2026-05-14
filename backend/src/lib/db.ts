import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.js";

/**
 * Supabase Realtime needs a WebSocket constructor.
 * Render's current Node 20 Playwright image does not provide one globally.
 */
(globalThis as any).WebSocket = WebSocket;

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
 * Server side Supabase client using service role key.
 * Full access, no RLS restrictions.
 */
export const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: WebSocket as any,
  },
});

/**
 * Optional alias for files that import supabase instead of db.
 */
export const supabase = db;