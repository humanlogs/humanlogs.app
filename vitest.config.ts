import { defineConfig } from "vitest/config";

/**
 * Vitest covers the *logic* of the app — most importantly the real-time
 * collaboration layer, which is the hardest part to keep correct by hand.
 *
 * Two suites, both running in Node (no jsdom needed):
 *
 *  - `tests/unit`        pure functions (segment projection, transport codecs,
 *                        socket auth). Milliseconds, no I/O.
 *  - `tests/integration` a REAL Socket.io server + REAL socket.io-client
 *                        connections + REAL Y.Docs on an ephemeral port. This is
 *                        what actually protects the collab protocol: seeding
 *                        authority, late joiners, authority hand-off, E2E
 *                        opacity, convergence under concurrent edits.
 *
 * Browser-level behaviour (TipTap rendering, remote carets, autosave) is covered
 * by Playwright — see `playwright.config.ts`.
 */
export default defineConfig({
  // Resolves the `@/*` path alias from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Socket.io integration tests bind real ports and use real timers; give them
    // room but keep unit tests snappy.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Each integration file owns a server + several sockets. Running files in
    // separate forks keeps module-level state (socket-server's `io` singleton,
    // its in-memory room map) isolated.
    pool: "forks",
    reporters: process.env.CI ? ["default", "github-actions"] : ["default"],
  },
});
