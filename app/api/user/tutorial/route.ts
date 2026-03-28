import { requireAuth } from "@/lib/auth-helpers";
import { NextRequest, NextResponse } from "next/server";
import { createTutorialTranscription } from "../../../../lib/tutorial-helpers";

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
}
