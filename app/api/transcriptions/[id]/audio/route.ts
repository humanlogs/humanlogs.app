import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { NextResponse } from "next/server";

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

    // Get the audio file from storage
    const storage = getStorage();
    const buffer = await storage.getFileBuffer(transcription.audioFileKey);

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
    return new Response(buffer, {
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
