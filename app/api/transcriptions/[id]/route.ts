import { getSTTService } from "@/lib/stt/stt-service";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import { Transcription } from "@prisma/client";
import _ from "lodash";
import { NextResponse } from "next/server";
import { EncryptedDataEntity } from "../../../../lib/encryption/encryption-entities";
import { getStorage } from "../../../../lib/storage";
import {
  completeTranscription,
  failTranscription,
} from "@/lib/stt/transcription-completion";
import { checkAccess } from "@/lib/transcriptions/access";
import {
  validateCodeRefs,
  validateSpeakerCodeRefs,
} from "@/lib/codebooks/codebook";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

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
      if (transcription.state === "PENDING") {
        transcription = await pollPendingTranscriptions(transcription);
      }

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
        codes?: never;
        speakerCodes?: never;
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
            { error: "Only the owner can change the study" },
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
              { error: "Study not found" },
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

      // Codes applied to the document and to its speakers. Any writer may
      // code, but the codes must come from the *owner's* codebooks — those are
      // the ones scoped to the study this document sits in.
      if (body.codes !== undefined || body.speakerCodes !== undefined) {
        const projectId =
          updateData.projectId !== undefined
            ? updateData.projectId
            : transcription.projectId;

        const codebooks = await prisma.codebook.findMany({
          where: {
            userId: transcription.userId,
            OR: [
              { allStudies: true },
              ...(projectId ? [{ studies: { some: { projectId } } }] : []),
            ],
          },
          select: { id: true },
        });
        const allowed = new Set(codebooks.map((c) => c.id));

        if (body.codes !== undefined) {
          const parsed = validateCodeRefs(body.codes, allowed);
          if ("error" in parsed) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
          }
          updateData.codes = parsed.codes as never;
        }

        if (body.speakerCodes !== undefined) {
          const parsed = validateSpeakerCodeRefs(
            body.speakerCodes,
            allowed,
          );
          if ("error" in parsed) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
          }
          updateData.speakerCodes = parsed.speakerCodes as never;
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

        // Create a history entry (snapshot of the PRE-save state) before updating.
        // Coalesce rapid saves: collaborative autosave debounces every few seconds,
        // which would otherwise create a history row per tick. Skip the snapshot when
        // the last one is very recent AND the change is minor — keeping the pre-burst
        // checkpoint instead of every quickly-overwritten intermediate. A significant
        // change always gets its own checkpoint so it stays revertable.
        if (transcription.transcription !== null) {
          const HISTORY_COALESCE_MS = 2 * 60 * 1000; // 2 min
          const SIGNIFICANT_CHANGE = 40; // words added + removed + changed
          const changeMagnitude =
            (changeStats.additions || 0) +
            (changeStats.removals || 0) +
            (changeStats.changed || 0);

          const lastEntry = await prisma.transcriptionHistory.findFirst({
            where: { transcriptionId: id, userId: user.id },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          });
          const recentlyCheckpointed =
            !!lastEntry &&
            Date.now() - lastEntry.updatedAt.getTime() < HISTORY_COALESCE_MS;

          if (!recentlyCheckpointed || changeMagnitude >= SIGNIFICANT_CHANGE) {
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
        }

        updateData.transcription = body.transcription as never;
        updateData.updatedBy = user.id;
      }

      const updated = await prisma.transcription.update({
        where: { id },
        data: updateData,
      });

      // Notify the owner AND every collaborator so their sidebar/header/detail
      // queries refetch (the acting user is always one of them). This does NOT
      // clobber a live collaborative editor: the editor seeds once and ignores
      // later `segments` prop changes.
      const recipients = new Set<string>([updated.userId]);
      const sharedUsers =
        (updated.shared as { userId?: string }[] | null) ?? [];
      for (const s of sharedUsers) if (s?.userId) recipients.add(s.userId);
      for (const uid of recipients) {
        notifyDatabaseChange(uid, "transcription", "update", { id: updated.id });
      }

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
        // Use the common function to complete the transcription
        return await completeTranscription(
          transcription.id,
          status.transcription,
          transcription,
        );
      } else if (status.status === "failed") {
        // Use the common function to mark as failed
        return await failTranscription(
          transcription.id,
          status.error || "Transcription failed",
          transcription,
        );
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
    "mediaType",
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
    "codes",
    "speakerCodes",
    "userId",
  ]);
