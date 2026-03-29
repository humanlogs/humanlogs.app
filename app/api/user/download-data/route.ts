import { requireAuth } from "@/lib/auth-helpers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import archiver from "archiver";
import { Readable } from "stream";

// Helper function to convert transcription data to readable text
function transcriptionToText(transcription: any): string {
  if (!transcription?.words) {
    return "No transcription available.";
  }

  const speakers = transcription.speakers || [];
  const speakerMap = new Map(
    speakers.map((s: any) => [s.id, s.name || `Speaker ${s.id}`]),
  );

  let currentSpeaker: string | null = null;
  let text = "";

  for (const word of transcription.words) {
    if (word.type === "spacing") {
      text += word.text;
    } else if (word.type === "word") {
      // Add speaker label if speaker changes
      if (word.speakerId && word.speakerId !== currentSpeaker) {
        currentSpeaker = word.speakerId;
        const speakerName =
          speakerMap.get(currentSpeaker) || `Speaker ${currentSpeaker}`;
        text += `\n\n${speakerName}:\n`;
      }
      text += word.text;
    }
  }

  return text.trim();
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const { includeAudio = false } = body;

    const userId = user.id;

    // Fetch all transcriptions for the user
    const transcriptions = await prisma.transcription.findMany({
      where: { userId },
      include: {
        project: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (transcriptions.length === 0) {
      return NextResponse.json(
        { error: "No transcriptions found" },
        { status: 404 },
      );
    }

    // Create archive
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    // Convert archive to web stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        archive.on("data", (chunk) => {
          controller.enqueue(new Uint8Array(chunk));
        });

        archive.on("end", () => {
          controller.close();
        });

        archive.on("error", (err) => {
          controller.error(err);
        });
      },
    });

    // Start building the archive asynchronously
    (async () => {
      try {
        const storage = getStorage();
        let includedCount = 0;
        let encryptedCount = 0;

        // Process each transcription
        for (const transcription of transcriptions) {
          // Check encryption status
          const transcriptionData = transcription.transcription as any;
          const isTranscriptionEncrypted = !!(
            transcriptionData?.privateKeys && transcriptionData?.payload
          );
          const isAudioEncrypted = !!transcription.audioFileEncryption;

          // Skip if transcription is encrypted and we can't provide meaningful content
          // (encrypted transcript, or encrypted audio when audio is requested)
          if (isTranscriptionEncrypted && (!includeAudio || isAudioEncrypted)) {
            encryptedCount++;
            continue;
          }

          // Skip if only audio is requested but it's encrypted
          if (
            includeAudio &&
            !isTranscriptionEncrypted &&
            isAudioEncrypted &&
            transcription.state !== "COMPLETED"
          ) {
            encryptedCount++;
            continue;
          }

          includedCount++;

          // Create a safe folder name
          const folderName = `${transcription.title.replace(/[/\\?%*:|"<>]/g, "-")}-${transcription.id.substring(0, 8)}`;

          // Prepare metadata (exclude encrypted transcription data)
          const metadata: any = {
            id: transcription.id,
            title: transcription.title,
            language: transcription.language,
            vocabulary: transcription.vocabulary,
            speakerCount: transcription.speakerCount,
            state: transcription.state,
            projectName: transcription.project?.name,
            createdAt: transcription.createdAt.toISOString(),
            updatedAt: transcription.updatedAt.toISOString(),
            completedAt: transcription.completedAt?.toISOString(),
            audioFileName: transcription.audioFileName,
            audioFileSize: transcription.audioFileSize,
          };

          // Only include transcription in metadata if not encrypted
          if (!isTranscriptionEncrypted) {
            metadata.transcription = transcription.transcription;
          }

          // Add metadata.json
          archive.append(JSON.stringify(metadata, null, 2), {
            name: `${folderName}/metadata.json`,
          });

          // Add transcript.txt if available and not encrypted
          if (
            transcription.transcription &&
            transcription.state === "COMPLETED" &&
            !isTranscriptionEncrypted
          ) {
            try {
              const textContent = transcriptionToText(transcriptionData);
              archive.append(textContent, {
                name: `${folderName}/transcript.txt`,
              });
            } catch (error) {
              console.error(
                `Failed to process transcript for ${transcription.id}:`,
                error,
              );
            }
          }

          // Add audio file if requested and not encrypted
          if (includeAudio && transcription.audioFileKey && !isAudioEncrypted) {
            try {
              const audioBuffer = await storage.getFileBuffer(
                transcription.audioFileKey,
              );
              archive.append(audioBuffer, {
                name: `${folderName}/${transcription.audioFileName}`,
              });
            } catch (error) {
              console.error(
                `Failed to add audio for ${transcription.id}:`,
                error,
              );
              // Add error note
              archive.append(
                `Failed to retrieve audio file: ${error instanceof Error ? error.message : "Unknown error"}`,
                { name: `${folderName}/audio-error.txt` },
              );
            }
          }
        }

        // Add README
        const readme = `# Your Transcription Data Export

Exported on: ${new Date().toISOString()}
Total transcriptions: ${transcriptions.length}
Included in export: ${includedCount}
Encrypted (excluded): ${encryptedCount}
User: ${user.email}${user.name ? ` (${user.name})` : ""}

## Contents

Each folder contains:
- **metadata.json**: Transcription metadata${!includeAudio ? " and raw transcription data" : ""}
- **transcript.txt**: Human-readable transcript (when available)
${includeAudio ? "- **audio file**: Original audio file\n" : ""}
## Important Notes

**End-to-End Encryption**: ${encryptedCount > 0 ? `${encryptedCount} transcription(s) were excluded because they are end-to-end encrypted. ` : ""}Encrypted content can only be decrypted in your browser using your private encryption keys, which are never sent to the server. This ensures maximum privacy and security for your sensitive data.

To access encrypted transcriptions:
1. Log in to the web application
2. Your browser will automatically decrypt the content using your local encryption keys
3. You can then view, edit, or export the decrypted content

## Additional Information

- Timestamps in metadata are in ISO 8601 format
- Each transcription is in its own folder for easy organization
`;

        archive.append(readme, { name: "README.md" });

        // Finalize the archive
        await archive.finalize();
      } catch (error) {
        console.error("Archive creation error:", error);
        archive.abort();
      }
    })();

    // Return the stream
    return new NextResponse(readable, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="transcription-data-${new Date().toISOString().split("T")[0]}.zip"`,
      },
    });
  } catch (error) {
    console.error("Download data error:", error);
    return NextResponse.json(
      { error: "Failed to download data" },
      { status: 500 },
    );
  }
}
