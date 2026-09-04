// Must stay the first import: it starts Sentry, whose auto-instrumentation only
// wraps http/pg/undici if it loads before they do. Imports are hoisted, so an
// `initSentry()` call placed further down would run too late.
import "./lib/observability/instrument";

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initSocketServer } from "./lib/sockets/socket-server";
import { captureError, flushSentry } from "./lib/observability/sentry";

// Global error handlers to prevent silent crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  captureError(reason, { stage: "unhandled-rejection" });
  // Don't exit the process, just log the error
});

process.on("uncaughtException", (error) => {
  // ERR_INVALID_STATE from a ReadableStream means a client disconnected
  // mid-stream. It is not a server fault; do not crash the process.
  if ((error as NodeJS.ErrnoException).code === "ERR_INVALID_STATE") {
    console.warn("Ignored stream error (client disconnect):", error.message);
    return;
  }
  console.error("Uncaught Exception:", error);
  captureError(error, { stage: "uncaught-exception" });
  // Don't exit immediately, give time for logging
  setTimeout(() => {
    console.error("Process will exit due to uncaught exception");
    // The report is worth more than the last second of uptime: this is the one
    // crash class that takes the process down with it.
    void flushSentry(1000).finally(() => process.exit(1));
  }, 1000);
});

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Create HTTP server with Next.js handler
const httpServer = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url!, true);
    await handle(req, res, parsedUrl);
  } catch (err) {
    console.error("Error handling request:", err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

// Initialize Socket.io BEFORE app.prepare()
// This ensures socket is ready when API routes (which import Prisma) load
initSocketServer(httpServer);
console.log("Socket.io server initialized");

app.prepare().then(async () => {
  // Initialize cron jobs in production
  if (!dev) {
    try {
      const { initializeCronJobs } = await import("./lib/utils/cron-jobs");
      initializeCronJobs();
    } catch (error) {
      console.error("Failed to initialize cron jobs:", error);
      console.log("Server will continue without cron jobs");
    }
  }

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
