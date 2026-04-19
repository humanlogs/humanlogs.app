import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HumanLogs vs Goodtape.io - Privacy-First Alternative",
  description:
    "Compare HumanLogs and Goodtape.io for research transcription. See why researchers choose HumanLogs for end-to-end encryption, zero retention policy, and advanced keyboard-driven editing.",
  keywords: [
    "Goodtape alternative",
    "Goodtape.io vs HumanLogs",
    "research transcription",
    "encrypted transcription",
    "privacy-focused transcription",
    "academic transcription tool",
  ],
  openGraph: {
    title: "HumanLogs vs Goodtape.io - Better Privacy for Research",
    description:
      "Why researchers choose HumanLogs: end-to-end encryption, zero retention, faster editing. Compare features and pricing.",
    url: "https://humanlogs.app/alternatives/goodtapeio",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs vs Goodtape.io Comparison",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HumanLogs vs Goodtape.io - Privacy-First Alternative",
    description:
      "Compare research transcription platforms. Better privacy, faster editing.",
    images: ["/landing/og-image.png"],
  },
};

export default function GoodtapeIOLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
