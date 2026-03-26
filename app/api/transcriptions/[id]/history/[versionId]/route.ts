import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{
    id: string;
    versionId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id, versionId } = await params;

    // Fetch the transcription to verify ownership
    const transcription = await prisma.transcription.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 },
      );
    }

    if (transcription.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch all history entries (we need to find the previous version)
    // @ts-expect-error - TranscriptionHistory model exists but TypeScript may need reload
    const allHistory = await prisma.transcriptionHistory.findMany({
      where: {
        transcriptionId: id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        transcription: true,
        updatedAt: true,
      },
    });

    // Find the requested version and the one before it
    const versionIndex = allHistory.findIndex(
      (h: { id: string }) => h.id === versionId,
    );

    if (versionIndex === -1) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 },
      );
    }

    const currentVersion = allHistory[versionIndex];
    const previousVersion =
      versionIndex < allHistory.length - 1 ? allHistory[versionIndex + 1] : null;

    return NextResponse.json({
      current: currentVersion.transcription,
      previous: previousVersion?.transcription || null,
    });
  } catch (error) {
    console.error("Error fetching version:", error);
    return NextResponse.json(
      { error: "Failed to fetch version" },
      { status: 500 },
    );
  }
}
