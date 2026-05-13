import "./lib/env.js";
import { app } from "./app.js";
import { logger } from "./lib/logger.js";

const PORT = parseInt(process.env.PORT || "4000", 10);

app.listen(PORT, () => {
  logger.info(`Authority Gap Engine backend running on port ${PORT}`);
});
