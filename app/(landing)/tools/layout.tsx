import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Audio & Video Tools | HumanLogs",
  description:
    "Free online tools for audio conversion, video to audio extraction, audio compression, and SRT subtitle testing. All processing happens in your browser - completely private and secure.",
  keywords: [
    "audio converter",
    "video to audio",
    "audio compression",
    "SRT tester",
    "free audio tools",
    "online converter",
    "browser-based conversion",
    "privacy-focused tools",
  ],
  openGraph: {
    title: "Free Audio & Video Conversion Tools - HumanLogs",
    description:
      "Convert audio formats, extract audio from video, compress files, and test SRT subtitles. All free, fast, and completely private - processing happens in your browser.",
    url: "https://humanlogs.app/tools",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs - Free Audio and Video Tools",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Audio & Video Tools - HumanLogs",
    description:
      "Convert, compress, and process audio files in your browser. Completely free and private.",
    images: ["/landing/og-image.png"],
  },
};

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
