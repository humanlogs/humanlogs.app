import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HumanLogs Alternatives - Compare Transcription Solutions",
  description:
    "Compare HumanLogs with other transcription services. See how our privacy-first, end-to-end encrypted platform stacks up against alternatives for research, journalism, and professional transcription.",
  keywords: [
    "transcription alternatives",
    "transcription comparison",
    "privacy-focused transcription",
    "research transcription tools",
    "transcription software comparison",
  ],
  openGraph: {
    title: "HumanLogs Alternatives - Compare Transcription Solutions",
    description:
      "Compare privacy-focused transcription platforms. Find the best tool for your research, journalism, or professional needs.",
    url: "https://humanlogs.app/alternatives",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs - Compare Transcription Alternatives",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HumanLogs Alternatives - Compare Transcription Solutions",
    description:
      "Compare privacy-focused transcription platforms for research and professional use.",
    images: ["/landing/og-image.png"],
  },
};

export default function AlternativesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
