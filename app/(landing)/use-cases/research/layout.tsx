import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transcription for Academic Research | HumanLogs",
  description:
    "Privacy-first transcription for PhD students, universities, and qualitative researchers. End-to-end encrypted, zero retention policy, GDPR compliant. Perfect for confidential research interviews.",
  keywords: [
    "research transcription",
    "academic transcription",
    "PhD transcription",
    "qualitative research",
    "interview transcription",
    "university transcription",
    "GDPR compliant transcription",
    "confidential research",
  ],
  openGraph: {
    title: "Secure Transcription for Academic Research - HumanLogs",
    description:
      "Trusted by researchers worldwide. End-to-end encrypted transcription with zero retention for confidential interviews and qualitative analysis.",
    url: "https://humanlogs.app/use-cases/research",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs - Research Transcription Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Secure Transcription for Academic Research - HumanLogs",
    description:
      "End-to-end encrypted transcription for PhD students and researchers. Zero retention, GDPR compliant.",
    images: ["/landing/og-image.png"],
  },
};

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
