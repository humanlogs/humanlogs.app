import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { defaultMetadata } from "@/lib/metadatas";
import {
  EncryptionSection,
  FAQSection,
  FeaturesSection,
  PricingSection,
  TestimonialsSection,
} from "./components/sections";
import { HeroSection } from "./components/sections/hero-section";
import { LogoSection } from "./components/sections/logo-section";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "metadata.home",
  });

  return {
    ...defaultMetadata(`https://humanlogs.app/en`),
    title: t("title"),
    description: t("description"),
    keywords: t("keywords").split(", "),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: `https://humanlogs.app/${locale}`,
      siteName: "humanlogs.app",
      images: [
        {
          url: "/landing/og-image.png",
          width: 1200,
          height: 630,
          alt: t("ogAlt"),
        },
      ],
      locale:
        locale === "en"
          ? "en_US"
          : locale === "fr"
            ? "fr_FR"
            : locale === "de"
              ? "de_DE"
              : "es_ES",
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

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <HeroSection />
      <LogoSection />
      <FeaturesSection />
      <TestimonialsSection />
      <EncryptionSection />
      <PricingSection showFeatureGrid={false} />
      <FAQSection />
    </>
  );
}
