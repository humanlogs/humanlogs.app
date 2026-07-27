import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import {
  DEFAULT_CODEBOOK_TARGET,
  parseCodebookInput,
} from "@/lib/codebooks/codebook";
import { formatCodebook, ownsAllStudies } from "@/lib/codebooks/server";

/**
 * Every codebook of the current user. The list is small (a handful per study)
 * and the client needs all of it to resolve scopes and to decrypt names, so
 * there is no pagination and no per-study filtering here.
 */
export const GET = withAuthRateLimit(async (request, user) => {
  try {
    const codebooks = await prisma.codebook.findMany({
      where: { userId: user.id },
      include: { studies: { select: { projectId: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ codebooks: codebooks.map(formatCodebook) });
  } catch (error) {
    console.error("Error fetching codebooks:", error);
    return NextResponse.json(
      { error: "Failed to fetch codebooks" },
      { status: 500 },
    );
  }
});

export const POST = withAuthRateLimit(async (request, user) => {
  try {
    const body = await request.json();
    const parsed = parseCodebookInput(body, { requireContent: true });
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { content, allStudies, studyIds, parentId, target, preset } =
      parsed.data;

    // "All studies" ignores any explicit list: the scope is already total.
    const links = allStudies ? [] : (studyIds ?? []);
    if (!(await ownsAllStudies(user.id, links))) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    if (parentId) {
      const parent = await prisma.codebook.findFirst({
        where: { id: parentId, userId: user.id },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent codebook not found" },
          { status: 404 },
        );
      }
    }

    const codebook = await prisma.codebook.create({
      data: {
        userId: user.id,
        content: content as never,
        allStudies: allStudies ?? false,
        parentId: parentId ?? null,
        target: target ?? DEFAULT_CODEBOOK_TARGET,
        preset: preset ?? null,
        studies: { create: links.map((projectId) => ({ projectId })) },
      },
      include: { studies: { select: { projectId: true } } },
    });

    return NextResponse.json(formatCodebook(codebook));
  } catch (error) {
    console.error("Error creating codebook:", error);
    return NextResponse.json(
      { error: "Failed to create codebook" },
      { status: 500 },
    );
  }
});
