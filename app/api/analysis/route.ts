import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { prisma } from "@/lib/prisma";
import { analysisKey } from "@/lib/analysis/analysis-facets";
import { NextResponse } from "next/server";

/**
 * A study's written analyses.
 *
 * The WHOLE study comes back in one request, and that is deliberate. An analysis
 * is attached to a set of facets, and the question the table asks of them —
 * "which of these are narrower than the slice I am showing" — is a containment
 * test over sets, which no index can serve. A study holds tens to hundreds of
 * notes, not thousands, so the honest answer is to hand them all over and let the
 * reader intersect. See `lib/analysis/analysis-facets.ts`.
 *
 * A study belongs to one user (there is no project-level sharing in this app;
 * documents are shared individually), so ownership is the whole access rule.
 */

/** The note as the client reads it. */
function serialize(row: {
  id: string;
  key: string;
  facets: unknown;
  body: string;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    key: row.key,
    facets: Array.isArray(row.facets) ? (row.facets as string[]) : [],
    body: row.body,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ownsStudy(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  return !!project;
}

export const GET = withAuthRateLimit(async (request, user) => {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 },
    );
  }
  if (!(await ownsStudy(projectId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await prisma.analysis.findMany({
    where: { projectId, userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ analyses: rows.map(serialize) });
});

/**
 * Write one note.
 *
 * The key is recomputed here from the facets rather than trusted from the client:
 * it is the only thing that decides which note a future view finds, and a
 * client that sorted differently would silently create a second note for the same
 * slice. An empty body DELETES — clearing the box is how a researcher retracts an
 * analysis, and keeping an empty row would leave a note that shows as written.
 */
export const PUT = withAuthRateLimit(async (request, user) => {
  const body = (await request.json()) as {
    projectId?: unknown;
    facets?: unknown;
    body?: unknown;
  };

  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 },
    );
  }
  if (
    !Array.isArray(body.facets) ||
    body.facets.some((facet) => typeof facet !== "string")
  ) {
    return NextResponse.json(
      { error: "facets must be an array of strings" },
      { status: 400 },
    );
  }
  if (typeof body.body !== "string") {
    return NextResponse.json(
      { error: "body must be a string" },
      { status: 400 },
    );
  }
  // A slice is a handful of facets; anything larger is not a question anyone asked.
  if (body.facets.length > 32) {
    return NextResponse.json({ error: "too many facets" }, { status: 400 });
  }
  if (body.body.length > 20000) {
    return NextResponse.json(
      { error: "analysis is too long" },
      { status: 400 },
    );
  }
  if (!(await ownsStudy(projectId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const facets = Array.from(new Set(body.facets as string[])).sort();
  const key = analysisKey(facets);
  const text = body.body.trim();

  if (!text) {
    await prisma.analysis.deleteMany({
      where: { projectId, userId: user.id, key },
    });
    return NextResponse.json({ analysis: null });
  }

  const row = await prisma.analysis.upsert({
    where: {
      projectId_userId_key: { projectId, userId: user.id, key },
    },
    create: { projectId, userId: user.id, key, facets, body: text },
    update: { facets, body: text },
  });
  return NextResponse.json({ analysis: serialize(row) });
});
