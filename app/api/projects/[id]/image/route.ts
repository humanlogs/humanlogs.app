import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

// Allowed upload types → the extension we store the key under. `svg` is
// deliberately excluded (avoids serving user-authored markup).
const TYPE_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_TO_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

type RouteParams = { params: Promise<{ id: string }> };

/** Upload (or replace) a study's custom image. */
export const POST = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;

      const project = await prisma.project.findFirst({
        where: { id, userId: user.id },
      });
      if (!project) {
        return NextResponse.json({ error: "Study not found" }, { status: 404 });
      }

      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const ext = TYPE_TO_EXT[file.type];
      if (!ext) {
        return NextResponse.json(
          { error: "Unsupported image type (use PNG, JPEG, WebP or GIF)" },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "Image is too large (max 2MB)" },
          { status: 400 },
        );
      }

      const storage = getStorage();
      const key = `${user.id}/projects/${id}/icon-${Date.now()}.${ext}`;
      await storage.upload(key, buffer, file.type);

      // Remove the previous image (key changes each upload, so it would orphan).
      const previousKey = project.imageKey;

      const updated = await prisma.project.update({
        where: { id },
        data: { iconType: "image", imageKey: key, icon: null },
      });

      if (previousKey && previousKey !== key) {
        try {
          await storage.delete(previousKey);
        } catch (err) {
          console.error("Failed to delete previous study image:", err);
        }
      }

      return NextResponse.json({
        id: updated.id,
        name: updated.name,
        iconType: updated.iconType,
        icon: updated.icon,
        color: updated.color,
        hasImage: !!updated.imageKey,
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("Error uploading study image:", error);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 },
      );
    }
  },
);

/** Serve a study's custom image. */
export const GET = withAuthRateLimit(
  async (_request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;

      const project = await prisma.project.findFirst({
        where: { id, userId: user.id },
        select: { imageKey: true },
      });
      if (!project?.imageKey) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const ext = project.imageKey.split(".").pop()?.toLowerCase() ?? "";
      const contentType = EXT_TO_TYPE[ext] ?? "application/octet-stream";

      const buffer = await getStorage().getFileBuffer(project.imageKey);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": contentType,
          // Cache-bust is handled by the `?v=updatedAt` query the client adds.
          "Cache-Control": "private, max-age=86400",
        },
      });
    } catch (error) {
      console.error("Error serving study image:", error);
      return NextResponse.json(
        { error: "Failed to load image" },
        { status: 500 },
      );
    }
  },
);
