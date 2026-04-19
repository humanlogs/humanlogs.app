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
    namespace: "freetools.tools.srtTester",
  });

  const title = t("title");
  const seoDescription = t("seoDescription");

  return {
    ...defaultMetadata("https://humanlogs.app/en/tools/srt-tester"),
    title: `${title} | HumanLogs`,
    description: seoDescription,
  };
}

export default function SRTTesterLayout({ children }: Props) {
  return <>{children}</>;
}
