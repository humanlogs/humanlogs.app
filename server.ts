import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initSocketServer } from "./lib/socket-server";
import { initializeCronJobs } from "./lib/cron-jobs";

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

app.prepare().then(() => {
  // Initialize cron jobs in production
  if (!dev) {
    try {
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
