import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.metadata.home");

  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords").split(", "),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "https://humanlogs.app",
      siteName: "humanlogs.app",
      images: [
        {
          url: "/landing/og-image.png",
          width: 1200,
          height: 630,
          alt: t("ogAlt"),
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: ["/landing/og-image.png"],
    },
  };
}

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
