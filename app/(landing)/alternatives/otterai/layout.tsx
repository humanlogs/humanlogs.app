import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HumanLogs vs Otter.ai - Privacy-First Alternative",
  description:
    "Compare HumanLogs and Otter.ai for transcription. HumanLogs offers end-to-end encryption, zero retention policy, and is designed for researchers who need complete confidentiality.",
  keywords: [
    "Otter.ai alternative",
    "Otter vs HumanLogs",
    "private transcription",
    "encrypted transcription",
    "research transcription",
    "confidential transcription",
  ],
  openGraph: {
    title: "HumanLogs vs Otter.ai - Complete Privacy & Control",
    description:
      "Why choose HumanLogs over Otter.ai: true end-to-end encryption, zero data retention, built for research confidentiality.",
    url: "https://humanlogs.app/alternatives/otterai",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs vs Otter.ai Comparison",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HumanLogs vs Otter.ai - Privacy-First Alternative",
    description:
      "True end-to-end encryption and zero retention for researchers. Compare HumanLogs and Otter.ai.",
    images: ["/landing/og-image.png"],
  },
};

export default function OtterAILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
