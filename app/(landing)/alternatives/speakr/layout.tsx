import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HumanLogs vs Speakr - Privacy-First Alternative",
  description:
    "Compare HumanLogs and Speakr for transcription needs. HumanLogs provides end-to-end encryption, faster keyboard-driven editing, and complete data control for researchers and professionals.",
  keywords: [
    "Speakr alternative",
    "Speakr vs HumanLogs",
    "private transcription",
    "encrypted transcription",
    "research transcription tool",
  ],
  openGraph: {
    title: "HumanLogs vs Speakr - Better Privacy & Control",
    description:
      "Compare HumanLogs and Speakr: end-to-end encryption, zero retention, advanced editing features for research.",
    url: "https://humanlogs.app/alternatives/speakr",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs vs Speakr Comparison",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HumanLogs vs Speakr - Privacy-First Alternative",
    description:
      "End-to-end encrypted transcription with advanced editing. Compare features.",
    images: ["/landing/og-image.png"],
  },
};

export default function SpeakrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
