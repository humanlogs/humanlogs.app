import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transcription for Podcasters | HumanLogs",
  description:
    "Create accurate transcripts for your podcast episodes. Improve SEO, accessibility, and reach with fast, privacy-focused transcription. Export to multiple formats, support for all languages.",
  keywords: [
    "podcast transcription",
    "podcaster tool",
    "episode transcription",
    "podcast SEO",
    "podcast accessibility",
    "audio transcription",
    "show notes",
    "podcast content",
  ],
  openGraph: {
    title: "Podcast Transcription Made Easy - HumanLogs",
    description:
      "Boost your podcast's reach with accurate transcripts. Fast editing, SEO-friendly, accessible to all listeners.",
    url: "https://humanlogs.app/use-cases/podcasting",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs - Podcast Transcription Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Podcast Transcription Made Easy - HumanLogs",
    description:
      "Fast, accurate transcription for podcasters. Boost SEO and accessibility.",
    images: ["/landing/og-image.png"],
  },
};

export default function PodcastingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
