import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "useCasesResearch",
  });

  const title = t("title");
  const description = t("intro");

  return {
    title: `${title} | HumanLogs`,
    description,
    openGraph: {
      title: `${title} - HumanLogs`,
      description: t("subtitle"),
      url: `https://humanlogs.app/${locale}/use-cases/research`,
      siteName: "humanlogs.app",
      images: [
        {
          url: "/landing/og-image.png",
          width: 1200,
          height: 630,
          alt: "HumanLogs - Research Transcription Platform",
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
      title: `${title} - HumanLogs`,
      description: t("subtitle"),
      images: ["/landing/og-image.png"],
    },
    alternates: {
      languages: {
        en: "https://humanlogs.app/en/use-cases/research",
        fr: "https://humanlogs.app/fr/use-cases/research",
        de: "https://humanlogs.app/de/use-cases/research",
        es: "https://humanlogs.app/es/use-cases/research",
      },
    },
  };
}

export default function ResearchLayout({ children }: Props) {
  return <>{children}</>;
}
