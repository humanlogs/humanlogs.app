import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { sectionColor } from "@/components/docs/docs-section-color";
import { getDocsNav } from "@/lib/utils/docs-utils";
import type { Locale } from "@/lib/utils/i18n";
import { cn } from "@/lib/utils/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "docs" });

  return {
    title: `${t("index.title")} - HumanLogs`,
    description: t("index.subtitle"),
    alternates: { canonical: `/${locale}/docs` },
  };
}

export default async function DocsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "docs" });
  const sections = getDocsNav(locale as Locale);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-10">
        <h1 className="text-4xl font-bold mb-4">{t("index.title")}</h1>
        <p className="text-lg text-gray-600">{t("index.subtitle")}</p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        {sections.map((section) => (
          <section
            key={section.slug}
            className="rounded-xl border border-gray-200 p-5 transition-colors hover:border-blue-500"
          >
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 rounded-full",
                  sectionColor(section.slug).dot,
                )}
              />
              {t(`sections.${section.slug}`)}
            </h2>
            <ul className="space-y-1.5">
              {section.pages.slice(0, 5).map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/docs/${page.slug}`}
                    className="text-sm text-gray-600 hover:text-black"
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
            {section.pages.length > 5 && (
              <Link
                href={`/docs/${section.pages[0].slug}`}
                className="mt-3 inline-block text-sm text-blue-600 hover:underline"
              >
                {t("index.seeAll", { count: section.pages.length })}
              </Link>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
