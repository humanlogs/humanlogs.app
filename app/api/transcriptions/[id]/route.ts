import { getSTTService } from "@/lib/stt/stt-service";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import { Transcription } from "@prisma/client";
import crypto from "crypto";
import _ from "lodash";
import { NextResponse } from "next/server";
import {
  EncryptedDataEntity,
  EncryptionUtils,
} from "../../../../lib/encryption/encryption-entities";
import { getStorage } from "../../../../lib/storage";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

type SharedUser = { userId: string; role: "read" | "read+listen" | "write" };

// Helper function to check user access to a transcription
function checkAccess(
  transcription: Transcription,
  userId: string,
  requiredRole?: "read" | "read+listen" | "write",
): { hasAccess: boolean; isOwner: boolean; role: string | null } {
  const isOwner = transcription.userId === userId;
  const shared = (transcription.shared as SharedUser[]) || [];
  const sharedUser = shared.find((s) => s.userId === userId);

  if (isOwner) {
    return { hasAccess: true, isOwner: true, role: "owner" };
  }

  if (!sharedUser) {
    return { hasAccess: false, isOwner: false, role: null };
  }

  // Check if user's role meets the requirement
  if (requiredRole) {
    const roleHierarchy: Record<string, number> = {
      read: 1,
      "read+listen": 2,
      write: 3,
    };

    const hasAccess =
      roleHierarchy[sharedUser.role] >= roleHierarchy[requiredRole];
    return { hasAccess, isOwner: false, role: sharedUser.role };
  }

  return { hasAccess: true, isOwner: false, role: sharedUser.role };
}

export const GET = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;

      // Fetch the transcription
      let transcription = await prisma.transcription.findUnique({
        where: {
          id,
        },
      });

      // Check if transcription exists
      if (!transcription) {
        return NextResponse.json(
          { error: "Transcription not found" },
          { status: 404 },
        );
      }

      // Check if user has access to this transcription (any role)
      const access = checkAccess(transcription, user.id);
      if (!access.hasAccess) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // If transcription is PENDING and we have an ElevenLabs ID, check status
      transcription = await pollPendingTranscriptions(transcription);

      // Return the transcription with access information
      const details = mapTransactionDetails(transcription);
      return NextResponse.json({
        ...details,
        isOwner: access.isOwner,
        role: access.role,
        // Only include shared list for owners
        shared: details.shared,
      });
    } catch (error) {
      console.error("Error fetching transcription:", error);
      return NextResponse.json(
        { error: "Failed to fetch transcription" },
        { status: 500 },
      );
    }
  },
);

export const PATCH = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;
      const body = await request.json();

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

      // Check if user has write access to this transcription
      const access = checkAccess(transcription, user.id, "write");
      if (!access.hasAccess) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Update the transcription
      const updateData: {
        title?: string;
        projectId?: string | null;
        transcription?: never;
        updatedBy?: string;
      } = {};

      // Only owner can change title and projectId
      if (body.title !== undefined) {
        if (!access.isOwner) {
          return NextResponse.json(
            { error: "Only the owner can change the title" },
            { status: 403 },
          );
        }
        if (typeof body.title !== "string" || !body.title.trim()) {
          return NextResponse.json(
            { error: "Title must be a non-empty string" },
            { status: 400 },
          );
        }
        updateData.title = body.title.trim();
      }

      if (body.projectId !== undefined) {
        if (!access.isOwner) {
          return NextResponse.json(
            { error: "Only the owner can change the project" },
            { status: 403 },
          );
        }
        if (body.projectId === null) {
          updateData.projectId = null;
        } else if (typeof body.projectId === "string") {
          // Verify the project exists and belongs to the user
          const project = await prisma.project.findUnique({
            where: { id: body.projectId },
          });

          if (!project) {
            return NextResponse.json(
              { error: "Project not found" },
              { status: 404 },
            );
          }

          if (project.userId !== user.id) {
            return NextResponse.json(
              { error: "Unauthorized" },
              { status: 403 },
            );
          }

          updateData.projectId = body.projectId;
        } else {
          return NextResponse.json(
            { error: "projectId must be a string or null" },
            { status: 400 },
          );
        }
      }

      // Handle transcription content updates
      if (body.transcription !== undefined) {
        if (
          typeof body.transcription !== "object" ||
          body.transcription === null
        ) {
          return NextResponse.json(
            { error: "transcription must be an object" },
            { status: 400 },
          );
        }

        // Extract change stats from request body (computed by frontend)
        const changeStats = body.changeStats || {
          additions: 0,
          removals: 0,
          changed: 0,
        };

        // Check we are not disclosing encrypted data
        if (body.transcription && !body.transcription.privateKeys?.length) {
          // Means we are sending unencrypted data
          if (
            (transcription.audioFileEncryption as EncryptedDataEntity)
              ?.privateKeys?.length
          ) {
            // Means we should deal with encrypted data but we are sending unencrypted data, this should not happen
            return NextResponse.json(
              {
                error:
                  "Cannot update transcription with unencrypted data when the original transcription is encrypted",
              },
              { status: 400 },
            );
          }
        }

        // Create a history entry before updating
        if (transcription.transcription !== null) {
          await prisma.transcriptionHistory.create({
            data: {
              transcriptionId: id,
              userId: user.id,
              transcription: transcription.transcription as never,
              updatedBy: user.id,
              additions: changeStats.additions || 0,
              removals: changeStats.removals || 0,
              changed: changeStats.changed || 0,
            },
          });
        }

        updateData.transcription = body.transcription as never;
        updateData.updatedBy = user.id;
      }

      const updated = await prisma.transcription.update({
        where: { id },
        data: updateData,
      });

      // Notify client of transcription update
      notifyDatabaseChange(user.id, "transcription", "update", {
        id: updated.id,
      });

      return NextResponse.json(mapTransactionDetails(updated));
    } catch (error) {
      console.error("Error updating transcription:", error);
      return NextResponse.json(
        { error: "Failed to update transcription" },
        { status: 500 },
      );
    }
  },
);

export const DELETE = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;

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

      // Check if user owns this transcription
      if (transcription.userId !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Delete all history entries for this transcription
      await prisma.transcriptionHistory.deleteMany({
        where: { transcriptionId: id, userId: user.id },
      });

      // Delete the audio file from storage if it exists (but not tutorial files)
      if (
        transcription.audioFileKey &&
        !transcription.audioFileKey.startsWith("tutorial:")
      ) {
        await getStorage().delete(transcription.audioFileKey);
      }

      // Delete the transcription
      await prisma.transcription.delete({
        where: { id, userId: user.id },
      });

      // Notify client of transcription deletion
      notifyDatabaseChange(user.id, "transcription", "delete", { id });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting transcription:", error);
      return NextResponse.json(
        { error: "Failed to delete transcription" },
        { status: 500 },
      );
    }
  },
);

export const pollPendingTranscriptions = async (
  transcription: Transcription,
): Promise<Transcription> => {
  console.log("Polling transcription status for ID:", transcription.id);
  const stt = getSTTService();
  if (
    transcription.state === "PENDING" &&
    transcription.elevenLabsTranscriptionId &&
    stt.isConfigured()
  ) {
    try {
      const status = await stt.getTranscriptionStatus(
        transcription.elevenLabsTranscriptionId,
      );

      if (status.status === "completed" && status.transcription) {
        // If the transcription is an EncryptedDataEntity, we'll automatically update it with the new transcription result, encrypted with the transcription's public key
        const encodedTranscription = await new EncryptionUtils(crypto).encrypt(
          transcription.transcription as EncryptedDataEntity,
          status.transcription,
        );

        // Update the transcription with the result
        const updated = await prisma.transcription.update({
          where: { id: transcription.id },
          data: {
            state: "COMPLETED",
            transcription: encodedTranscription as never,
            completedAt: new Date(),
          },
        });

        // Notify client of transcription completion
        notifyDatabaseChange(transcription.userId, "transcription", "update", {
          id: updated.id,
        });

        return updated;
      } else if (status.status === "failed") {
        // Update with error
        const updated = await prisma.transcription.update({
          where: { id: transcription.id },
          data: {
            state: "ERROR",
            errorMessage: status.error || "Transcription failed",
          },
        });

        // Notify client of transcription error
        notifyDatabaseChange(transcription.userId, "transcription", "update", {
          id: updated.id,
        });

        return updated;
      }
      // If still processing, continue with original transcription data
    } catch (error) {
      console.error("Error checking transcription status:", error);
      // Continue with original transcription data
    }
  }

  if (
    // No STT ID after 1 hour is not normal
    // Normal not to have one for the first few minutes as we convert the file
    ((!transcription.elevenLabsTranscriptionId &&
      new Date(transcription.createdAt).getTime() <
        Date.now() - 60 * 60 * 1000) ||
      // If we have an ID but it's been pending for more than 24h, something is wrong
      new Date(transcription.createdAt).getTime() <
        Date.now() - 24 * 60 * 60 * 1000) &&
    // Only target pending transcriptions as completed or error ones should be updated with the result, we don't want to override any manual update on completed transcriptions
    transcription.state === "PENDING" &&
    stt.isConfigured()
  ) {
    // Update the transcription with the result
    return await prisma.transcription.update({
      where: { id: transcription.id },
      data: {
        state: "ERROR",
      },
    });
  }

  return transcription;
};

export const mapTransactionDetails = (transcription: Transcription) =>
  _.pick(transcription, [
    "id",
    "title",
    "audioFileName",
    "audioFileSize",
    "audioFileKey",
    "audioFileEncryption",
    "language",
    "vocabulary",
    "speakerCount",
    "state",
    "errorMessage",
    "transcription",
    "projectId",
    "createdAt",
    "updatedAt",
    "completedAt",
    "isTutorial",
    "shared",
    "userId",
  ]);
