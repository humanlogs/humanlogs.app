import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { execFile } from "child_process";
import { createServer } from "net";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Run a CLI against the test database, surfacing its output on failure. */
async function run(cmd: string, args: string[], url: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      env: { ...process.env, DATABASE_URL: url },
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch (error: any) {
    throw new Error(
      `${cmd} ${args.join(" ")} failed:\n${error.stdout ?? ""}\n${error.stderr ?? ""}`,
    );
  }
}

/**
 * A throwaway PostgreSQL for tests — no Docker, no daemon, no `createdb`.
 *
 * Why not SQLite (which would be the obvious "simple" choice)? The schema and
 * the queries are Postgres-specific in ways that are not worth degrading just to
 * make tests run:
 *   - `enum` types (TranscriptionState, ReferralStatus, FeedbackType) and scalar
 *     lists (`vocabulary String[]`) are unsupported by Prisma on SQLite;
 *   - transcription sharing is queried with raw JSONB containment (`shared @> …`),
 *     which has no SQLite equivalent.
 * Testing against SQLite would therefore mean testing a *different* schema than
 * the one that runs in production — the tests would pass while sharing broke.
 *
 * PGlite is real PostgreSQL compiled to WASM, running in-process. Exposed on a
 * TCP socket it looks exactly like a normal server, so the app's own
 * `@prisma/adapter-pg` connects to it unchanged.
 *
 * The schema is applied with `prisma db push` (no migration history needed for a
 * disposable database), exactly as suggested for a simple test setup.
 */

export type TestDatabase = {
  url: string;
  stop: () => Promise<void>;
};

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Boot an ephemeral Postgres and push the Prisma schema into it.
 *
 * `dataDir` is optional: omitted, the database lives in memory and disappears
 * with the process. `port` is optional too: omitted, the OS picks a free one.
 */
export async function startTestDatabase(
  opts: { dataDir?: string; push?: boolean; port?: number } = {},
): Promise<TestDatabase> {
  const db = await PGlite.create(opts.dataDir);
  const port = opts.port ?? (await freePort());
  const server = new PGLiteSocketServer({
    db,
    port,
    host: "127.0.0.1",
    // The app runs a connection pool, and `prisma db push` opens its own
    // connections; a single-connection server would deadlock.
    maxConnections: 20,
  });
  await server.start();

  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;

  if (opts.push !== false) {
    // `db push` is enough for a disposable database: it materialises the current
    // schema.prisma directly, with no migration history to replay.
    //
    // It MUST be spawned asynchronously: PGlite serves this connection from the
    // very event loop we are running on, so a synchronous child process would
    // block the server and Prisma would fail with "can't reach database server".
    // No `--accept-data-loss`: the database is always freshly created, so the
    // push is purely additive (and Prisma 7 gates that flag behind a prompt).
    await run("npx", ["prisma", "db", "push", "--url", url], url);
  }

  return {
    url,
    stop: async () => {
      await server.stop();
      await db.close();
    },
  };
}
