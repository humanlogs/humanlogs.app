import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireAuth();

    // Fetch all transcriptions for the user (up to 1000)
    const transcriptions = await prisma.transcription.findMany({
      where: {
        userId: user.id,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 1000,
    });

    // Transform to match the frontend format
    const formattedTranscriptions = transcriptions.map((t) => ({
      id: t.id,
      title: t.audioFileName,
      updatedAt: t.updatedAt.toISOString(),
      projectId: t.projectId,
      projectName: t.project?.name,
      state: t.state,
      errorMessage: t.errorMessage,
    }));

    return NextResponse.json(formattedTranscriptions);
  } catch (error) {
    console.error("Error fetching transcriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcriptions" },
      { status: 500 },
    );
  }
}
