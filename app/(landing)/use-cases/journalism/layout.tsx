import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transcription for Journalists & Media | HumanLogs",
  description:
    "Secure transcription for investigative journalism, interviews, and media production. End-to-end encryption protects sources, fast editing meets deadlines, zero retention ensures confidentiality.",
  keywords: [
    "journalism transcription",
    "interview transcription",
    "media transcription",
    "investigative journalism",
    "reporter transcription",
    "news transcription",
    "source protection",
    "confidential journalism",
  ],
  openGraph: {
    title: "Secure Transcription for Journalists - HumanLogs",
    description:
      "Protect your sources with end-to-end encryption. Fast, accurate transcription for interviews and investigative journalism.",
    url: "https://humanlogs.app/use-cases/journalism",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs - Journalism Transcription Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Secure Transcription for Journalists - HumanLogs",
    description:
      "End-to-end encrypted transcription for interviews. Protect sources, meet deadlines.",
    images: ["/landing/og-image.png"],
  },
};

export default function JournalismLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
