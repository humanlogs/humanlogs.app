import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { parseAppearanceUpdate } from "@/lib/projects/appearance";
import { getStorage } from "@/lib/storage";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";

function formatProject(p: {
  id: string;
  name: string;
  iconType: string | null;
  icon: string | null;
  color: string | null;
  imageKey: string | null;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    name: p.name,
    iconType: p.iconType,
    icon: p.icon,
    color: p.color,
    hasImage: !!p.imageKey,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const PATCH = withAuthRateLimit(
  async (request, user, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const body = await request.json();

      const existingProject = await prisma.project.findFirst({
        where: { id, userId: user.id },
      });

      if (!existingProject) {
        return NextResponse.json({ error: "Study not found" }, { status: 404 });
      }

      const data: {
        name?: string;
        iconType?: string;
        icon?: string;
        color?: string;
        imageKey?: null;
      } = {};

      // Name is optional now (appearance-only updates are allowed), but if
      // provided it must be non-empty.
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || !body.name.trim()) {
          return NextResponse.json(
            { error: "Study name is required" },
            { status: 400 },
          );
        }
        data.name = body.name.trim();
      }

      const appearance = parseAppearanceUpdate(body);
      if ("error" in appearance) {
        return NextResponse.json({ error: appearance.error }, { status: 400 });
      }
      Object.assign(data, appearance.data);

      // Switching to an icon/emoji drops any previously uploaded image; remove
      // the stored file so it doesn't linger orphaned.
      const switchingAwayFromImage =
        (appearance.data.iconType === "icon" ||
          appearance.data.iconType === "emoji") &&
        existingProject.imageKey;
      if (switchingAwayFromImage) {
        data.imageKey = null;
        try {
          await getStorage().delete(existingProject.imageKey!);
        } catch (err) {
          console.error("Failed to delete old study image:", err);
        }
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(formatProject(existingProject));
      }

      const project = await prisma.project.update({
        where: { id },
        data,
      });

      return NextResponse.json(formatProject(project));
    } catch (error) {
      console.error("Error updating project:", error);
      return NextResponse.json(
        { error: "Failed to update study" },
        { status: 500 },
      );
    }
  },
);

/**
 * Delete a study. The caller decides what happens to its transcriptions:
 *  - mode "move": reassign them to `targetProjectId` (or unassigned when null),
 *    then delete the study.
 *  - mode "delete": permanently delete every attached transcription (audio,
 *    history and all) along with the study.
 */
export const DELETE = withAuthRateLimit(
  async (request, user, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;

      const project = await prisma.project.findFirst({
        where: { id, userId: user.id },
      });
      if (!project) {
        return NextResponse.json({ error: "Study not found" }, { status: 404 });
      }

      const body = await request.json().catch(() => ({}));
      const mode = body.mode === "delete" ? "delete" : "move";
      const targetProjectId: string | null = body.targetProjectId ?? null;

      const storage = getStorage();

      if (mode === "move") {
        // Guard: the destination study must belong to the user (null is fine —
        // it means "no study").
        if (targetProjectId) {
          if (targetProjectId === id) {
            return NextResponse.json(
              { error: "Cannot move transcriptions to the study being deleted" },
              { status: 400 },
            );
          }
          const target = await prisma.project.findFirst({
            where: { id: targetProjectId, userId: user.id },
            select: { id: true },
          });
          if (!target) {
            return NextResponse.json(
              { error: "Destination study not found" },
              { status: 404 },
            );
          }
        }

        await prisma.transcription.updateMany({
          where: { projectId: id, userId: user.id },
          data: { projectId: targetProjectId },
        });
      } else {
        // Permanently delete each attached transcription and its stored audio.
        const transcriptions = await prisma.transcription.findMany({
          where: { projectId: id, userId: user.id },
          select: { id: true, audioFileKey: true },
        });

        await prisma.transcriptionHistory.deleteMany({
          where: {
            transcriptionId: { in: transcriptions.map((t) => t.id) },
            userId: user.id,
          },
        });

        for (const t of transcriptions) {
          if (t.audioFileKey && !t.audioFileKey.startsWith("tutorial:")) {
            try {
              await storage.delete(t.audioFileKey);
            } catch (err) {
              console.error("Failed to delete audio for", t.id, err);
            }
          }
        }

        await prisma.transcription.deleteMany({
          where: { projectId: id, userId: user.id },
        });
      }

      // Remove the study's own image, if any, then the study.
      if (project.imageKey) {
        try {
          await storage.delete(project.imageKey);
        } catch (err) {
          console.error("Failed to delete study image:", err);
        }
      }

      await prisma.project.delete({ where: { id } });

      // Both the transcription list and the project list changed.
      notifyDatabaseChange(user.id, "transcription", "delete", { projectId: id });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting project:", error);
      return NextResponse.json(
        { error: "Failed to delete study" },
        { status: 500 },
      );
    }
  },
);
