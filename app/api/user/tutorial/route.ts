import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { notifyDatabaseChange } from "@/lib/socket-helpers";
import * as fs from "fs/promises";
import * as path from "path";

export const dynamic = "force-dynamic";

const SUPPORTED_LANGUAGES = ["en", "fr", "es", "de"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { language = "en" } = body;

    if (!isSupportedLanguage(language)) {
      return NextResponse.json(
        { error: "Unsupported language" },
        { status: 400 },
      );
    }

    // Delete existing tutorial transcription
    const existingTutorial = await prisma.transcription.findFirst({
      where: {
        userId: user.id,
        title: { startsWith: "Tutorial" },
      },
    });

    if (existingTutorial) {
      await prisma.transcription.delete({
        where: { id: existingTutorial.id },
      });
      notifyDatabaseChange(user.id, "transcription", "delete", {
        id: existingTutorial.id,
      });
    }

    // Load the tutorial transcript
    const tutorialPath = path.join(
      process.cwd(),
      "assets",
      "tutorial",
      language,
      "transcript.json",
    );
    const transcriptContent = await fs.readFile(tutorialPath, "utf-8");
    const transcript = JSON.parse(transcriptContent);

    // Get audio file stats
    const audioPath = path.join(
      process.cwd(),
      "assets",
      "tutorial",
      language,
      "audio.mp3",
    );
    const audioStats = await fs.stat(audioPath);

    // Get tutorial title based on language
    const tutorialTitles: Record<SupportedLanguage, string> = {
      en: "Tutorial - Getting Started",
      fr: "Tutoriel - Commencer",
      es: "Tutorial - Comenzar",
      de: "Tutorial - Erste Schritte",
    };

    // Create the tutorial transcription
    const tutorialTranscription = await prisma.transcription.create({
      data: {
        userId: user.id,
        title: tutorialTitles[language],
        audioFileKey: `tutorial:${language}:audio.mp3`, // Special prefix to identify tutorial files
        audioFileName: "tutorial.mp3",
        audioFileSize: audioStats.size,
        transcription: transcript,
        language: language,
        vocabulary: [],
        speakerCount: 1,
        state: "COMPLETED",
        completedAt: new Date(),
        updatedBy: "system",
      },
    });

    // Notify about the new transcription
    notifyDatabaseChange(user.id, "transcription", "create", {
      id: tutorialTranscription.id,
    });

    return NextResponse.json({
      success: true,
      transcription: tutorialTranscription,
    });
  } catch (error) {
    console.error("Error resetting tutorial:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reset tutorial",
      },
      { status: 500 },
    );
  }
}
