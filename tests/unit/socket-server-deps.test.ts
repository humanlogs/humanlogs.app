import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join, relative, resolve } from "path";

/**
 * The socket server must not depend on Prisma — at all, anywhere in its import
 * graph.
 *
 * It runs inside the custom Node server (server.ts, started by tsx), which does
 * not carry the generated Prisma client. A module that reaches it does not fail
 * loudly at build time; it fails at runtime, on the connection path, where the
 * symptom is "collaboration is broken" and the cause is three imports away. That
 * is what forced authorization to be short-circuited before room grants existed.
 *
 * So this walks the real import graph from the server entry and fails on the
 * first module that pulls Prisma in. An accidental `import { checkAccess } from
 * "@/lib/transcriptions/access"` — which looks entirely reasonable — is caught
 * here rather than in production.
 */

const ROOT = resolve(__dirname, "../..");
const ENTRY = join(ROOT, "lib/sockets/socket-server.ts");

const FORBIDDEN = ["@prisma/client", "@/lib/prisma", ".prisma/client"];

/** Every module specifier a file imports, `import type` included. */
function importsOf(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

/** Resolve a specifier to a file in this repo, or null if it is a package. */
function resolveLocal(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else return null;

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && !candidate.endsWith("/")) {
      try {
        readFileSync(candidate, "utf8");
        return candidate;
      } catch {
        // A directory — keep trying the more specific candidates.
      }
    }
  }
  return null;
}

/** Walk the graph, returning every "importer → forbidden specifier" it finds. */
function findPrismaDependencies(entry: string): string[] {
  const offences: string[] = [];
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, "utf8");
    for (const specifier of importsOf(source)) {
      if (FORBIDDEN.some((f) => specifier === f || specifier.startsWith(`${f}/`))) {
        offences.push(`${relative(ROOT, file)} → ${specifier}`);
        continue;
      }
      const resolved = resolveLocal(specifier, file);
      if (resolved) queue.push(resolved);
    }
  }

  return offences;
}

describe("socket server dependencies", () => {
  it("reaches no Prisma anywhere in its import graph", () => {
    expect(findPrismaDependencies(ENTRY)).toEqual([]);
  });

  it("detects a Prisma dependency when there is one", () => {
    // The guard above is only worth having if it can fail: point it at a module
    // that legitimately uses Prisma and it must say so.
    const offences = findPrismaDependencies(
      join(ROOT, "lib/transcriptions/access.ts"),
    );
    expect(offences.length).toBeGreaterThan(0);
  });
});
