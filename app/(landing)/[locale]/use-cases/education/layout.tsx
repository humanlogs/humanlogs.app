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
    namespace: "useCasesEducation",
  });

  const title = t("title");
  const description = t("intro");

  return {
    title: `${title} | HumanLogs`,
    description,
    openGraph: {
      title: `${title} - HumanLogs`,
      description: t("subtitle"),
      url: `https://humanlogs.app/${locale}/use-cases/education`,
      siteName: "humanlogs.app",
      images: [
        {
          url: "/landing/og-image.png",
          width: 1200,
          height: 630,
          alt: "HumanLogs - Education Transcription Platform",
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
        en: "https://humanlogs.app/en/use-cases/education",
        fr: "https://humanlogs.app/fr/use-cases/education",
        de: "https://humanlogs.app/de/use-cases/education",
        es: "https://humanlogs.app/es/use-cases/education",
      },
    },
  };
}

export default function EducationLayout({ children }: Props) {
  return <>{children}</>;
}
