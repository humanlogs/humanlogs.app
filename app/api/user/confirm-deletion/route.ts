import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { reconcileReferralsForDeletedUser } from "@/lib/referral";
import { recordDeletedAccountCredits } from "@/lib/billing/deleted-account-credits";

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
    await prisma.$transaction(async (tx) => {
      // Remember the credit balance behind a one-way hash of the email so a
      // fresh sign-up with the same address gets that balance back instead of
      // a new free allotment.
      await recordDeletedAccountCredits(deletionToken.user, tx);

      // Reconcile referral bonuses for anyone who referred this user, then drop
      // the referral rows that recorded them (referrals where this user is the
      // referrer cascade-delete with the user below).
      await reconcileReferralsForDeletedUser(userId, tx);

      // Delete transcription history
      await tx.transcriptionHistory.deleteMany({ where: { userId } });

      // Delete transcriptions
      await tx.transcription.deleteMany({ where: { userId } });

      // Delete projects
      await tx.project.deleteMany({ where: { userId } });

      // Delete feedback
      await tx.feedback.deleteMany({ where: { userId } });

      // Delete deletion tokens
      await tx.deletionToken.deleteMany({ where: { userId } });

      // Finally, delete the user (cascade-deletes referrals they sent)
      await tx.user.delete({ where: { id: userId } });
    });

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
