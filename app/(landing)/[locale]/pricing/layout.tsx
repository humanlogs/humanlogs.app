import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { defaultMetadata } from "@/lib/metadatas";

type Props = {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "pricing",
  });

  return {
    ...defaultMetadata(`https://humanlogs.app/en/pricing`),
    title: `${t("title")} | HumanLogs`,
    description: t("subtitle"),
  };
}

export default function PricingLayout({ children }: Props) {
  return <>{children}</>;
}
