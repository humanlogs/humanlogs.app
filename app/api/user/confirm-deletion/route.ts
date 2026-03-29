import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // Find the deletion token
    const deletionToken = await prisma.deletionToken.findUnique({
      where: { token },
      include: {
        user: true,
      },
    });

    if (!deletionToken) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 404 },
      );
    }

    // Check if token is expired
    if (deletionToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // Check if token was already used
    if (deletionToken.used) {
      return NextResponse.json(
        { error: "Token already used" },
        { status: 400 },
      );
    }

    const userId = deletionToken.userId;

    // Get all transcriptions to delete audio files
    const transcriptions = await prisma.transcription.findMany({
      where: { userId },
      select: { audioFileKey: true },
    });

    // Delete all audio files from storage
    const storage = getStorage();
    for (const transcription of transcriptions) {
      try {
        await storage.delete(transcription.audioFileKey);
      } catch (error) {
        console.error(
          `Failed to delete audio file ${transcription.audioFileKey}:`,
          error,
        );
        // Continue even if some files fail to delete
      }
    }

    // Delete user data in transaction
    await prisma.$transaction([
      // Delete transcription history
      prisma.transcriptionHistory.deleteMany({ where: { userId } }),

      // Delete transcriptions
      prisma.transcription.deleteMany({ where: { userId } }),

      // Delete projects
      prisma.project.deleteMany({ where: { userId } }),

      // Delete feedback
      prisma.feedback.deleteMany({ where: { userId } }),

      // Delete deletion tokens
      prisma.deletionToken.deleteMany({ where: { userId } }),

      // Mark token as used
      prisma.deletionToken.update({
        where: { id: deletionToken.id },
        data: { used: true },
      }),

      // Finally, delete the user
      prisma.user.delete({ where: { id: userId } }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Confirm deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
