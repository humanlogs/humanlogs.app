import type { Metadata } from "next";
import "../globals.css";
import { Layout } from "./_layout";
import { defaultMetadata } from "@/lib/metadatas";

export const metadata: Metadata = {
  ...defaultMetadata(),
  title: "HumanLogs - Privacy-First Transcription for Research",
  description:
    "End-to-end encrypted transcription platform built for researchers. Fast keyboard-driven editor, zero retention policy, open source. Perfect for PhD students, universities, and qualitative research.",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
