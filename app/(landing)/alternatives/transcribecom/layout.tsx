import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HumanLogs vs Transcribe.com - Privacy-First Alternative",
  description:
    "Compare HumanLogs and Transcribe.com for professional transcription. HumanLogs offers end-to-end encryption, zero data retention, and keyboard-driven editing built for researchers.",
  keywords: [
    "Transcribe.com alternative",
    "Transcribe vs HumanLogs",
    "private transcription",
    "encrypted transcription",
    "research transcription",
    "secure transcription tool",
  ],
  openGraph: {
    title: "HumanLogs vs Transcribe.com - Complete Privacy",
    description:
      "Why choose HumanLogs: end-to-end encryption, zero retention, designed for confidential research interviews.",
    url: "https://humanlogs.app/alternatives/transcribecom",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs vs Transcribe.com Comparison",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HumanLogs vs Transcribe.com - Privacy-First Alternative",
    description:
      "End-to-end encrypted transcription with zero data retention. Compare platforms.",
    images: ["/landing/og-image.png"],
  },
};

export default function TranscribeComLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
