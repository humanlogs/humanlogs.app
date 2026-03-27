import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Fetch the transcription
    const transcription = await prisma.transcription.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        audioFileKey: true,
        audioFileName: true,
      },
    });

    // Check if transcription exists
    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 },
      );
    }

    // Check if user owns this transcription
    if (transcription.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if audio file exists
    if (!transcription.audioFileKey) {
      return NextResponse.json(
        { error: "Audio file not found" },
        { status: 404 },
      );
    }

    let buffer: Buffer;

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
      buffer = await fs.readFile(audioPath);
    } else {
      // Get the audio file from storage (S3 or local)
      const storage = getStorage();
      buffer = await storage.getFileBuffer(transcription.audioFileKey);
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

    // Return audio file with streaming support
    return new Response(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error streaming audio:", error);
    return NextResponse.json(
      { error: "Failed to stream audio" },
      { status: 500 },
    );
  }
}
