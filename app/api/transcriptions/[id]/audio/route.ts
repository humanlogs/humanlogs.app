import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";
import { Readable } from "stream";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";

// Readable.toWeb() does not handle client disconnects gracefully — if the client
// closes the connection the controller is already closed when the source stream
// tries to enqueue the next chunk, throwing ERR_INVALID_STATE as an uncaught
// exception. This wrapper catches those errors and destroys the source stream.
function nodeToWebStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          nodeStream.destroy();
        }
      });
      nodeStream.on("end", () => {
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
      nodeStream.on("error", (err: Error) => {
        try {
          controller.error(err);
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export const GET = withAuthRateLimit(
  async (_request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;

      // Fetch the transcription
      const transcription = await prisma.transcription.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          audioFileKey: true,
          audioFileName: true,
          shared: true,
        },
      });

      // Check if transcription exists
      if (!transcription) {
        return NextResponse.json(
          { error: "Transcription not found" },
          { status: 404 },
        );
      }

      // Check if user has access to this transcription
      const isOwner = transcription.userId === user.id;
      type SharedUser = { userId: string; role: string };
      const shared = (transcription.shared as SharedUser[]) || [];
      const sharedUser = shared.find((s) => s.userId === user.id);
      const hasListenAccess =
        sharedUser?.role === "read+listen" || sharedUser?.role === "write";

      if (!isOwner && !hasListenAccess) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Check if audio file exists
      if (!transcription.audioFileKey) {
        return NextResponse.json(
          { error: "Audio file not found" },
          { status: 404 },
        );
      }

      let stream: ReadableStream<Uint8Array>;
      let contentLength: number | undefined;

      // Check if this is a tutorial transcription (stored locally)
      if (transcription.audioFileKey.startsWith("tutorial:")) {
        // Extract language from the key: tutorial:{language}:audio.mp3
        const parts = transcription.audioFileKey.split(":");
        const language = parts[1];

        // Load the tutorial audio file from assets
        const audioPath = path.join(
          process.cwd(),
          "assets",
          "tutorial",
          language,
          "audio.mp3",
        );
        const stats = await fsPromises.stat(audioPath);
        const nodeStream = fs.createReadStream(audioPath);
        stream = nodeToWebStream(nodeStream);
        contentLength = stats.size;
      } else {
        // Stream audio from storage (S3 or local)
        const storage = getStorage();
        const nodeStream = await storage.getFileStream(
          transcription.audioFileKey,
        );
        stream = nodeToWebStream(nodeStream as Readable);
      }

      // Determine content type from file extension
      const ext = transcription.audioFileName.split(".").pop()?.toLowerCase();
      const contentType =
        ext === "mp3"
          ? "audio/mpeg"
          : ext === "wav"
            ? "audio/wav"
            : ext === "m4a"
              ? "audio/mp4"
              : ext === "ogg"
                ? "audio/ogg"
                : ext === "webm"
                  ? "audio/webm"
                  : "audio/mpeg";

      const headers: HeadersInit = {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      };

      if (contentLength !== undefined) {
        headers["Content-Length"] = contentLength.toString();
      }

      // Return audio stream
      return new Response(stream, {
        status: 200,
        headers,
      });
    } catch (error) {
      console.error("Error streaming audio:", error);
      return NextResponse.json(
        { error: "Failed to stream audio" },
        { status: 500 },
      );
    }
  },
);
