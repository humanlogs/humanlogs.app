import { Metadata } from "next";

export const defaultMetadata = (url?: string) =>
  ({
    title: "HumanLogs - Privacy-First Transcription for Research",
    description:
      "End-to-end encrypted transcription platform built for researchers. Fast keyboard-driven editor, zero retention policy, open source. Perfect for PhD students, universities, and qualitative research.",

    alternates: {
      languages: {
        en: (url || "https://humanlogs.app/en").replace(/\.app\/en/, ".app/en"),
        fr: (url || "https://humanlogs.app/en").replace(/\.app\/en/, ".app/fr"),
        es: (url || "https://humanlogs.app/en").replace(/\.app\/en/, ".app/es"),
        de: (url || "https://humanlogs.app/en").replace(/\.app\/en/, ".app/de"),
      },
    },

    keywords: [
      "transcription",
      "research",
      "privacy",
      "end-to-end encryption",
      "academic",
      "PhD",
      "qualitative analysis",
      "open source",
    ],
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    },
    openGraph: {
      title:
        "humanlogs.app - Fast, confidential transcription for your research interviews",
      description:
        "Build and refine transcripts 4 times faster. End-to-end encrypted, 100+ languages, open source.",
      url: "https://humanlogs.app",
      siteName: "humanlogs.app",
      images: [
        {
          url: "https://humanlogs.app/landing/og-image.png",
          width: 1200,
          height: 630,
          alt: "humanlogs.app - Audio transcription software for research",
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "humanlogs.app - Fast, confidential transcription for research",
      description:
        "Build and refine transcripts 4 times faster. End-to-end encrypted, 100+ languages, open source.",
      images: ["https://humanlogs.app/landing/og-image.png"],
    },
  }) as Metadata;
