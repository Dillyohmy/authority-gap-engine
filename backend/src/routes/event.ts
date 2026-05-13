import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";

const EventSchema = z.object({
  event_type: z.string(),
  website_url: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const eventRouter = Router();

/**
 * POST /api/event
 * Stores analytics/tracking events.
 * Returns: { success: boolean }
 */
eventRouter.post("/", async (req, res, next) => {
  try {
    const data = EventSchema.parse(req.body);

    const { error } = await db.from("scan_events").insert({
      event_type: data.event_type,
      website_url: data.website_url ?? null,
      metadata_json: data.metadata ?? {},
    });

    if (error) {
      logger.warn(error, "Skipped storing event");
    }

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input" });
    }
    next(err);
  }
});
