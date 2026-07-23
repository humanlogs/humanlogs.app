import { parseMultipartToDisk } from "@/lib/audio/multipart-upload";
import { parseImport, type ImportFormat } from "@/lib/import";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { notifyDatabaseChange } from "@/lib/sockets/socket-helpers";
import crypto from "crypto";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { EncryptionUtils } from "@/lib/encryption/encryption-entities";

export const dynamic = "force-dynamic";

// Imported documents are small; keep a generous but bounded limit.
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * Import an already-produced transcript from a document (JSON, CSV, TXT, DOCX,
 * SRT, VTT, NVivo, MAXQDA). Unlike the audio create flow, there is no upload to
 * storage and no speech-to-text: we parse the file into the editor's content
 * shape (assigning per-word timestamps) and store a COMPLETED, text-typed
 * transcription. No credits are consumed because no STT runs.
 */
export const POST = withAuthRateLimit(async (request, user) => {
  let parsed: Awaited<ReturnType<typeof parseMultipartToDisk>> | null = null;

  try {
    parsed = await parseMultipartToDisk(request, { maxFileSize: MAX_FILE_SIZE });
    const fields = parsed.fields;

    const requestedFormat = (fields.format as ImportFormat | "auto") || "auto";
    const language = fields.language || "en";
    const projectId = fields.projectId || "";
    const titleField = (fields.title || "").trim();

    const file =
      parsed.files.find(
        (f) => f.fieldName === "file" || f.fieldName === "file_0",
      ) || parsed.files[0];

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.truncated) {
      return NextResponse.json(
        { error: "File is too large (max 25MB)" },
        { status: 413 },
      );
    }

    const filename = fields.fileName || file.filename || "document";
    const buffer = await readFile(file.tmpPath);

    // Parse the document into editor-ready content with per-word timestamps.
    let content;
    let format: ImportFormat;
    try {
      ({ content, format } = await parseImport(
        buffer,
        filename,
        requestedFormat,
      ));
    } catch (parseError) {
      return NextResponse.json(
        {
          error:
            parseError instanceof Error
              ? parseError.message
              : "Could not read the document",
        },
        { status: 400 },
      );
    }

    if (!content.words.length) {
      return NextResponse.json(
        { error: "The document contains no readable text" },
        { status: 400 },
      );
    }

    const speakerCount = Math.max(1, content.speakers.length);

    // Encrypt the transcript for the user when they have a public key, using the
    // same envelope the audio completion flow produces so the editor decrypts it
    // identically.
    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { publicKey: true },
    });
    let stored: unknown = content;
    if (userProfile?.publicKey) {
      const encryption = new EncryptionUtils(crypto);
      stored = await encryption.createEncryptedDataEntity(content, [
        await encryption.createEncryptedAccessorEntity(
          user.id,
          userProfile.publicKey,
        ),
      ]);
    }

    // Validate the target project belongs to the user.
    let validProjectId: string | null = null;
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (project && project.userId === user.id) {
        validProjectId = project.id;
      }
    }

    const title =
      titleField ||
      filename.replace(/\.[^.]+$/, "").trim() ||
      "Imported transcript";

    const created = await prisma.transcription.create({
      data: {
        userId: user.id,
        projectId: validProjectId,
        title,
        audioFileKey: "",
        audioFileName: filename,
        audioFileSize: 0,
        mediaType: "text",
        language,
        vocabulary: [],
        speakerCount,
        state: "COMPLETED",
        sttProvider: null,
        transcription: stored as never,
        completedAt: new Date(),
        updatedBy: user.id,
      },
    });

    notifyDatabaseChange(user.id, "transcription", "create", {
      id: created.id,
    });

    return NextResponse.json({
      success: true,
      transcriptionId: created.id,
      format,
    });
  } catch (error) {
    console.error("Error importing transcript:", error);
    return NextResponse.json(
      { error: "Failed to import transcript" },
      { status: 500 },
    );
  } finally {
    if (parsed) await parsed.cleanup();
  }
});
