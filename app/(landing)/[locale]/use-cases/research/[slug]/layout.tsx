import { getAllSeoSlugs, getSeoSlugConfig } from "@/lib/seo-research-slugs";
import type { Metadata } from "next";
import { defaultMetadata } from "@/lib/metadatas";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  const enSlugs = getAllSeoSlugs("en").map((slug) => ({ locale: "en", slug }));
  const frSlugs = getAllSeoSlugs("fr").map((slug) => ({ locale: "fr", slug }));
  return [...enSlugs, ...frSlugs];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const config = getSeoSlugConfig(slug, locale as "en" | "fr");

  if (!config) {
    return {
      title: "Research Transcription - HumanLogs",
      description: "Privacy-first transcription for researchers",
    };
  }

  // Load SEO content for this slug
  const seoContent = await import(
    `@/messages/${locale}/seo-research-content.json`
  );
  const content = seoContent.default[slug];

  if (!content) {
    return {
      title: "Research Transcription - HumanLogs",
      description: "Privacy-first transcription for researchers",
    };
  }

  const title = content.title;
  const description = content.description || content.intro;

  return {
    ...defaultMetadata(
      `https://humanlogs.app/${locale}/use-cases/research/${slug}`,
    ),
    title: `${title} | HumanLogs`,
    description,
    keywords: [config.keywords.primary, ...config.keywords.secondary],
  };
}

export default async function ResearchSeoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const _config = getSeoSlugConfig(slug, locale as "en" | "fr");
  const seoContent = await import(
    `@/messages/${locale}/seo-research-content.json`
  );
  const content = seoContent.default[slug];

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "HumanLogs",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Windows, macOS, Linux",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free tier available with premium plans",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "250",
    },
    description:
      content?.description ||
      "Privacy-first transcription software for researchers",
    featureList: [
      "End-to-end encryption",
      "GDPR and HIPAA compliant",
      "Audio-linked transcript editor",
      "Speaker diarization",
      "Export to NVivo, MAXQDA, Atlas.ti",
      "100+ languages supported",
      "Self-hosting option",
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {children}
    </>
  );
}
