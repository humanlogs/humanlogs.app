import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HumanLogs vs Vook.ai - Privacy-First Alternative",
  description:
    "Compare HumanLogs and Vook.ai for transcription. HumanLogs delivers end-to-end encryption, zero retention policy, and advanced keyboard shortcuts for researchers and professionals.",
  keywords: [
    "Vook.ai alternative",
    "Vook vs HumanLogs",
    "private transcription",
    "encrypted transcription",
    "research transcription",
    "secure transcription platform",
  ],
  openGraph: {
    title: "HumanLogs vs Vook.ai - Better Privacy & Security",
    description:
      "Compare transcription platforms: end-to-end encryption, zero retention, keyboard-driven workflow for research.",
    url: "https://humanlogs.app/alternatives/vookai",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs vs Vook.ai Comparison",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HumanLogs vs Vook.ai - Privacy-First Alternative",
    description:
      "True end-to-end encryption for research transcription. Compare features.",
    images: ["/landing/og-image.png"],
  },
};

export default function VookAILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
