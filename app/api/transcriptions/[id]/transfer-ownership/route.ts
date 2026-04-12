import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

type SharedUser = {
  userId: string;
  role: "read" | "read+listen" | "write";
};

export const POST = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;
      const body = await request.json();

      // Validate newOwnerId
      if (!body.newOwnerId || typeof body.newOwnerId !== "string") {
        return NextResponse.json(
          { error: "newOwnerId is required" },
          { status: 400 },
        );
      }

      // Fetch the transcription
      const transcription = await prisma.transcription.findUnique({
        where: { id },
      });

      // Check if transcription exists
      if (!transcription) {
        return NextResponse.json(
          { error: "Transcription not found" },
          { status: 404 },
        );
      }

      // Check if current user owns this transcription
      if (transcription.userId !== user.id) {
        return NextResponse.json(
          { error: "Only the owner can transfer ownership" },
          { status: 403 },
        );
      }

      // Check if new owner is different from current owner
      if (body.newOwnerId === user.id) {
        return NextResponse.json(
          { error: "Cannot transfer ownership to yourself" },
          { status: 400 },
        );
      }

      // Check if the new owner exists
      const newOwner = await prisma.user.findUnique({
        where: { id: body.newOwnerId },
      });

      if (!newOwner) {
        return NextResponse.json(
          { error: "New owner not found" },
          { status: 404 },
        );
      }

      // Get current shared list
      const currentShared = (transcription.shared as SharedUser[]) || [];

      // Check if the new owner is in the shared list
      const newOwnerInShared = currentShared.find(
        (s) => s.userId === body.newOwnerId,
      );

      if (!newOwnerInShared) {
        return NextResponse.json(
          { error: "User must have access to the transcription first" },
          { status: 400 },
        );
      }

      // Remove the new owner from the shared list
      const updatedShared = currentShared.filter(
        (s) => s.userId !== body.newOwnerId,
      );

      // Add the current owner to the shared list with write access
      updatedShared.push({
        userId: user.id,
        role: "write",
      });

      // Update the transcription with new owner and updated shared list
      await prisma.transcription.update({
        where: { id },
        data: {
          userId: body.newOwnerId,
          shared: updatedShared as never,
        },
      });

      await prisma.transcriptionHistory.updateMany({
        where: { transcriptionId: id },
        data: {
          userId: body.newOwnerId,
        },
      });

      // Notify both the old owner and new owner of the change
      notifyDatabaseChange(user.id, "transcription", "update", { id });
      notifyDatabaseChange(body.newOwnerId, "transcription", "update", { id });

      return NextResponse.json({
        success: true,
        newOwnerId: body.newOwnerId,
      });
    } catch (error) {
      console.error("Error transferring ownership:", error);
      return NextResponse.json(
        { error: "Failed to transfer ownership" },
        { status: 500 },
      );
    }
  },
);
