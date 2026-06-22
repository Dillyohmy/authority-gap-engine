/**
 * Combined worker entry point — starts all BullMQ workers in a single process.
 * Start command: node dist/workers/allWorkers.js
 */
import "./scanWorker.js";
import "./parseWorker.js";
import "./competitorCrawlWorker.js";
import "./competitorAnalysisWorker.js";
import "./fullReportWorker.js";
import "./growthPlanWorker.js";
import "./integrationWorker.js";
