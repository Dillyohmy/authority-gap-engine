import express from "express";
import cors from "cors";
import helmet from "helmet";
import { scanRouter } from "./routes/scan.js";
import { leadRouter } from "./routes/lead.js";
import { eventRouter } from "./routes/event.js";
import { projectRouter } from "./routes/projects.js";
import { uploadsRouter } from "./routes/uploads.js";
import { competitorsRouter, competitiveAnalysisRouter } from "./routes/competitors.js";
import { reportsRouter } from "./routes/reports.js";
import { growthPlansRouter } from "./routes/growthPlans.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const corsOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: corsOrigins.includes("*") ? "*" : corsOrigins }));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Routes
app.use("/api/scan", scanRouter);
app.use("/api/lead", leadRouter);
app.use("/api/event", eventRouter);
app.use("/api/projects", projectRouter);
app.use("/api/projects/:projectId/uploads", uploadsRouter);
app.use("/api/projects/:projectId/competitors", competitorsRouter);
app.use("/api/projects/:projectId/competitive-analysis", competitiveAnalysisRouter);
app.use("/api/projects/:projectId/reports", reportsRouter);
app.use("/api/projects/:projectId/growth-plans", growthPlansRouter);
app.use("/api/projects/:projectId/dashboard", dashboardRouter);

// Global error handler
app.use(errorHandler);

export { app };
