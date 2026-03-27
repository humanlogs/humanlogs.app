import { prisma } from "./prisma";
import * as fs from "fs/promises";
import * as path from "path";

const SUPPORTED_LANGUAGES = ["en", "fr", "es", "de"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const TUTORIAL_TITLES: Record<SupportedLanguage, string> = {
  en: "Tutorial - Getting Started",
  fr: "Tutoriel - Commencer",
  es: "Tutorial - Comenzar",
  de: "Tutorial - Erste Schritte",
};

/**
 * Create a tutorial transcription for a new user
 * This is called when a user first signs up
 */
export async function createTutorialTranscription(
  userId: string,
  language: string = "en",
): Promise<void> {
  // Validate language
  const requestedLanguage = SUPPORTED_LANGUAGES.includes(
    language as SupportedLanguage,
  )
    ? (language as SupportedLanguage)
    : "en";

  // Check if user already has a tutorial
  const existingTutorial = await prisma.transcription.findFirst({
    where: {
      userId: userId,
      title: { startsWith: "Tutorial" },
    },
  });

  if (existingTutorial) {
    // Tutorial already exists, don't create a duplicate
    return;
  }

  // Try to find tutorial files for the requested language, fall back to English
  let tutorialLanguage = requestedLanguage;
  let tutorialPath = path.join(
    process.cwd(),
    "assets",
    "tutorial",
    tutorialLanguage,
    "transcript.json",
  );

  try {
    await fs.access(tutorialPath);
  } catch {
    // Tutorial files don't exist for this language, fall back to English
    console.log(
      `Tutorial not available in ${tutorialLanguage}, falling back to English`,
    );
    tutorialLanguage = "en";
    tutorialPath = path.join(
      process.cwd(),
      "assets",
      "tutorial",
      tutorialLanguage,
      "transcript.json",
    );
  }

  try {
    // Load the tutorial transcript
    const transcriptContent = await fs.readFile(tutorialPath, "utf-8");
    const transcript = JSON.parse(transcriptContent);

    // Get audio file stats
    const audioPath = path.join(
      process.cwd(),
      "assets",
      "tutorial",
      tutorialLanguage,
      "audio.mp3",
    );
    const audioStats = await fs.stat(audioPath);

    // Create the tutorial transcription
    await prisma.transcription.create({
      data: {
        userId: userId,
        title: TUTORIAL_TITLES[tutorialLanguage],
        audioFileKey: `tutorial:${tutorialLanguage}:audio.mp3`,
        audioFileName: "tutorial.mp3",
        audioFileSize: audioStats.size,
        transcription: transcript,
        language: tutorialLanguage,
        vocabulary: [],
        speakerCount: 1,
        state: "COMPLETED",
        completedAt: new Date(),
        updatedBy: "system",
      },
    });

    console.log(
      `Created tutorial transcription for user ${userId} in ${tutorialLanguage}`,
    );
  } catch (error) {
    // Don't fail the signup if tutorial creation fails
    console.error("Failed to create tutorial transcription:", error);
  }
}
