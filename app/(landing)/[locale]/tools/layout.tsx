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
    namespace: "freetools",
  });

  const title = t("title");
  const subtitle = t("subtitle");

  return {
    ...defaultMetadata("https://humanlogs.app/en/tools"),
    title: `${title} | HumanLogs`,
    description: subtitle,
  };
}

export default function ToolsLayout({ children }: Props) {
  return <>{children}</>;
}
