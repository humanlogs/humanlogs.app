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
    namespace: "useCasesEducation",
  });

  const title = t("title");
  const description = t("intro");

  return {
    ...defaultMetadata(`https://humanlogs.app/${locale}/use-cases/education`),
    title: `${title} | HumanLogs`,
    description,
  };
}

export default function EducationLayout({ children }: Props) {
  return <>{children}</>;
}
