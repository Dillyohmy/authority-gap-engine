import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";

const LeadSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  wants_strategy_review: z.boolean(),
  website_url: z.string(),
  clinic_type: z.string(),
  location: z.string(),
});

export const leadRouter = Router();

/**
 * POST /api/lead
 * Stores lead capture data.
 * Returns: { success: boolean }
 */
leadRouter.post("/", async (req, res, next) => {
  try {
    const data = LeadSchema.parse(req.body);

    const { error } = await db.from("leads").insert({
      email: data.email,
      name: data.name ?? null,
      wants_strategy_review: data.wants_strategy_review,
      website_url: data.website_url,
      clinic_type: data.clinic_type,
      location: data.location,
    });

    if (error) {
      logger.warn(error, "Skipped storing lead");
      return res.json({ success: true, stored: false });
    }

    logger.info({ email: data.email }, "Lead captured");
    res.json({ success: true, stored: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    next(err);
  }
});
