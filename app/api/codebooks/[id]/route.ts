import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { parseCodebookInput } from "@/lib/codebooks/codebook";
import {
  formatCodebook,
  isSafeParent,
  ownsAllStudies,
} from "@/lib/codebooks/server";

type RouteParams = { params: Promise<{ id: string }> };

export const PATCH = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;
      const body = await request.json();

      const existing = await prisma.codebook.findFirst({
        where: { id, userId: user.id },
        include: { studies: { select: { projectId: true } } },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Codebook not found" },
          { status: 404 },
        );
      }

      const parsed = parseCodebookInput(body, { requireContent: false });
      if ("error" in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const { content, allStudies, studyIds, parentId, target, preset } =
        parsed.data;

      if (parentId !== undefined) {
        if (!(await isSafeParent(user.id, id, parentId))) {
          return NextResponse.json(
            { error: "Invalid parent codebook" },
            { status: 400 },
          );
        }
      }

      // Scope after the update, needed to check the "must be reachable" rule
      // against the fields the request leaves untouched.
      const nextAllStudies = allStudies ?? existing.allStudies;
      const nextStudyIds =
        studyIds ?? existing.studies.map((s) => s.projectId);
      if (!nextAllStudies && nextStudyIds.length === 0) {
        return NextResponse.json(
          { error: "A codebook must belong to at least one study" },
          { status: 400 },
        );
      }
      if (studyIds && !(await ownsAllStudies(user.id, studyIds))) {
        return NextResponse.json({ error: "Study not found" }, { status: 404 });
      }

      const codebook = await prisma.codebook.update({
        where: { id },
        data: {
          ...(content !== undefined ? { content: content as never } : {}),
          ...(allStudies !== undefined ? { allStudies } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
          ...(target !== undefined ? { target } : {}),
          ...(preset !== undefined ? { preset } : {}),
          // Links are replaced wholesale; an "all studies" codebook keeps none.
          ...(studyIds !== undefined || allStudies !== undefined
            ? {
                studies: {
                  deleteMany: {},
                  create: (nextAllStudies ? [] : nextStudyIds).map(
                    (projectId) => ({ projectId }),
                  ),
                },
              }
            : {}),
        },
        include: { studies: { select: { projectId: true } } },
      });

      return NextResponse.json(formatCodebook(codebook));
    } catch (error) {
      console.error("Error updating codebook:", error);
      return NextResponse.json(
        { error: "Failed to update codebook" },
        { status: 500 },
      );
    }
  },
);

/**
 * Deletes a codebook and, by cascade, its children. References left on
 * documents are not swept: `sanitizeCodeRefs` hides refs whose codebook is
 * gone, which avoids a large write on every delete.
 */
export const DELETE = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;

      const existing = await prisma.codebook.findFirst({
        where: { id, userId: user.id },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Codebook not found" },
          { status: 404 },
        );
      }

      await prisma.codebook.delete({ where: { id } });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting codebook:", error);
      return NextResponse.json(
        { error: "Failed to delete codebook" },
        { status: 500 },
      );
    }
  },
);
