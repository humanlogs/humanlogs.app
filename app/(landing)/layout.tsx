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
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
