import { defaultMetadata } from "@/lib/metadatas";
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
    namespace: "alternativesSpeakr",
  });

  const title = t("title");
  const intro = t("intro");

  return {
    ...defaultMetadata("https://humanlogs.app/en/alternatives/speakr"),
    title: `${title} | HumanLogs`,
    description: intro,
  };
}

export default function SpeakrLayout({ children }: Props) {
  return <>{children}</>;
}
