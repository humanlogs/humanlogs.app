import { NextRequest, NextResponse } from "next/server";
import { createTutorialTranscription } from "./tutorial-helpers";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";

export const dynamic = "force-dynamic";

const SUPPORTED_LANGUAGES = ["en", "fr", "es", "de"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

export const POST = withAuthRateLimit(async (request, user) => {
  try {
    const body = await request.json();
    const { language = "en" } = body;

    if (!isSupportedLanguage(language)) {
      return NextResponse.json(
        { error: "Unsupported language" },
        { status: 400 },
      );
    }

    const tutorialTranscription = await createTutorialTranscription(
      user.id,
      language,
    );

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
});
