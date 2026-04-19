import type { Metadata } from "next";
import { Layout } from "./_layout";
import {
  EncryptionSection,
  FAQSection,
  FeaturesSection,
  PricingSection,
  TestimonialsSection,
} from "./components/sections";
import { HeroSection } from "./components/sections/hero-section";
import { LogoSection } from "./components/sections/logo-section";

export const metadata: Metadata = {
  title: "HumanLogs - Fast, Confidential Transcription for Research Interviews",
  description:
    "Privacy-first transcription platform for researchers. 98% accuracy in 100+ languages, unique audio-based editor, end-to-end encryption. Transform your workflow in 2 minutes.",
  keywords: [
    "research transcription",
    "interview transcription",
    "academic transcription",
    "qualitative research",
    "PhD transcription",
    "confidential transcription",
    "encrypted transcription",
  ],
  openGraph: {
    title: "Fast, Confidential Transcription for Your Research Interviews",
    description:
      "98% accuracy in 100+ languages. Refine transcripts 4x faster with our unique audio-based editor. End-to-end encrypted, zero retention.",
    url: "https://humanlogs.app",
    siteName: "humanlogs.app",
    images: [
      {
        url: "/landing/og-image.png",
        width: 1200,
        height: 630,
        alt: "HumanLogs - Privacy-first transcription platform for research",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fast, Confidential Transcription for Your Research Interviews",
    description:
      "98% accuracy in 100+ languages. Refine transcripts 4x faster with our unique audio-based editor. End-to-end encrypted, zero retention.",
    images: ["/landing/og-image.png"],
  },
};

export default function LandingPage() {
  return (
    <Layout>
      <HeroSection />
      <LogoSection />
      <FeaturesSection />
      <TestimonialsSection />
      <EncryptionSection />
      <PricingSection showFeatureGrid={false} />
      <FAQSection />
    </Layout>
  );
}
