import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initSocketServer } from "./lib/sockets/socket-server";

// Global error handlers to prevent silent crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit the process, just log the error
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't exit immediately, give time for logging
  setTimeout(() => {
    console.error("Process will exit due to uncaught exception");
    process.exit(1);
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
