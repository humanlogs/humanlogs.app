import type { Metadata } from "next";
import "../globals.css";
import { Layout } from "./_layout";

export const metadata: Metadata = {
  title: "HumanLogs - Privacy-First Transcription for Research",
  description:
    "End-to-end encrypted transcription platform built for researchers. Fast keyboard-driven editor, zero retention policy, open source. Perfect for PhD students, universities, and qualitative research.",
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
  openGraph: {
    title:
      "HumanLogs - Fast, confidential transcription for your research interviews",
    description:
      "Build and refine transcripts 4 times faster thanks to our unique editor. End-to-end encrypted, 100+ languages, open source.",
    url: "https://humanlogs.app",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs - Audio transcription software for research",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HumanLogs - Fast, confidential transcription for research",
    description:
      "Build and refine transcripts 4 times faster. End-to-end encrypted, 100+ languages, open source.",
    images: ["/landing/og-image.png"],
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
