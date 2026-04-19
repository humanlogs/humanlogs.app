import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free SRT Subtitle File Validator & Tester | HumanLogs",
  description:
    "Validate and test your SRT subtitle files for formatting errors, timing issues, and compatibility problems. Free online tool that works entirely in your browser.",
  keywords: [
    "SRT validator",
    "SRT tester",
    "subtitle validator",
    "SRT file checker",
    "subtitle file tester",
    "free SRT tool",
    "subtitle format checker",
  ],
  openGraph: {
    title: "Free SRT Subtitle Validator & Tester - HumanLogs",
    description:
      "Check your SRT subtitle files for errors and formatting issues. Fast, free, and completely private - all validation happens in your browser.",
    url: "https://humanlogs.app/tools/srt-tester",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs - SRT Subtitle Validator",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free SRT Subtitle Validator - HumanLogs",
    description:
      "Validate SRT subtitle files for errors and formatting issues. Free and private.",
    images: ["/landing/og-image.png"],
  },
};

export default function SRTTesterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
