/**
 * Boots the whole stack for the Playwright suite, in one process:
 *
 *   1. an ephemeral PostgreSQL (PGlite, in-process — no Docker, no daemon),
 *   2. `prisma db push` to materialise the schema,
 *   3. the app's real custom server (`server.ts`), so Socket.io — and therefore
 *      collaboration — runs exactly as in production.
 *
 * Playwright launches this as its `webServer`. Keeping the database in the same
 * process as the launcher (rather than in Playwright's `globalSetup`) means the
 * app is never started before the schema exists.
 *
 * The database listens on a fixed port so the tests can connect to it too and
 * set up fixtures directly.
 */
import { spawn } from "child_process";
import { startTestDatabase } from "../db/pglite-server";
import { E2E_APP_PORT, E2E_DB_PORT } from "./config";

async function main() {
  console.log("[e2e] starting test database…");
  const db = await startTestDatabase({ port: E2E_DB_PORT });
  console.log(`[e2e] database ready on ${db.url}`);

  const app = spawn("npx", ["tsx", "server.ts"], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(E2E_APP_PORT),
      DATABASE_URL: db.url,
      // Local email/password auth — no Auth0 tenant needed to run the suite.
      AUTH_MODE: "local",
      AUTH_SESSION_SECRET:
        process.env.AUTH_SESSION_SECRET ?? "e2e-session-secret-not-a-real-one",
      // Socket.io checks the request origin against this: without it the
      // collaboration socket is CORS-refused and every collab test fails.
      NEXT_PUBLIC_APP_URL: `http://localhost:${E2E_APP_PORT}`,
    },
  });

  const shutdown = async (signal: NodeJS.Signals) => {
    app.kill(signal);
    await db.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  app.on("exit", (code) => {
    void db.stop().catch(() => {});
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("[e2e] failed to start:", error);
  process.exit(1);
});



