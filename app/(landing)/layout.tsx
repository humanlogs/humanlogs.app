import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import "../globals.css";
import { Layout } from "./_layout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.metadata.landing");

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

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
