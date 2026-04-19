import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HumanLogs Use Cases - Transcription for Every Need",
  description:
    "Discover how HumanLogs serves researchers, educators, journalists, and podcasters with privacy-first transcription. End-to-end encrypted, fast editing, and built for professional workflows.",
  keywords: [
    "transcription use cases",
    "research transcription",
    "education transcription",
    "journalism transcription",
    "podcast transcription",
    "professional transcription",
  ],
  openGraph: {
    title: "HumanLogs Use Cases - Privacy-First Transcription",
    description:
      "Trusted by researchers, educators, journalists, and podcasters for confidential, accurate transcription.",
    url: "https://humanlogs.app/use-cases",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs - Professional Transcription Use Cases",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HumanLogs Use Cases - Privacy-First Transcription",
    description:
      "For researchers, educators, journalists, and podcasters who need complete confidentiality.",
    images: ["/landing/og-image.png"],
  },
};

export default function UseCasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
