import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DocsMarkdown } from "@/components/docs/docs-markdown";
import { DocsStatusBadge } from "@/components/docs/docs-status-badge";
import { DocsToc } from "@/components/docs/docs-toc";
import { sectionColor } from "@/components/docs/docs-section-color";
import {
  getAllDocSlugs,
  getDoc,
  getDocPager,
  type DocMeta,
} from "@/lib/utils/docs-utils";
import type { Locale } from "@/lib/utils/i18n";
import { cn } from "@/lib/utils/utils";

type Props = { params: Promise<{ slug: string[]; locale: string }> };

export async function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug, locale } = await params;
  const doc = getDoc(slug.join("/"), locale as Locale);
  if (!doc) return {};

  return {
    title: `${doc.title} - HumanLogs Docs`,
    description: doc.description,
    alternates: { canonical: `/${locale}/docs/${doc.slug}` },
  };
}

function PagerLink({
  doc,
  direction,
  label,
}: {
  doc: DocMeta;
  direction: "previous" | "next";
  label: string;
}) {
  return (
    <Link
      href={`/docs/${doc.slug}`}
      className="group flex-1 rounded-xl border border-gray-200 p-4 transition-colors hover:border-blue-500"
    >
      <span className="flex items-center gap-1 text-xs text-gray-600">
        {direction === "previous" && <ChevronLeft className="h-3 w-3" />}
        {label}
        {direction === "next" && <ChevronRight className="h-3 w-3" />}
      </span>
      <span className="mt-1 block font-medium group-hover:text-blue-600">
        {doc.title}
      </span>
    </Link>
  );
}

export default async function DocPage({ params }: Props) {
  const { slug, locale } = await params;
  const path = slug.join("/");
  const doc = getDoc(path, locale as Locale);

  if (!doc) notFound();

  const t = await getTranslations({ locale, namespace: "docs" });
  const { previous, next } = getDocPager(path, locale as Locale);
  const related = doc.related
    .map((relatedSlug) => getDoc(relatedSlug, locale as Locale))
    .filter(
      (related): related is NonNullable<typeof related> => related !== null,
    );

  return (
    <div className="flex justify-center gap-12">
      <article className="mx-auto w-full min-w-0 max-w-3xl">
        <nav className="mb-6 text-sm text-gray-600">
          <Link href="/docs" className="hover:text-black">
            {t("index.title")}
          </Link>
          <span className="mx-2">/</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                sectionColor(doc.section).dot,
              )}
            />
            {t(`sections.${doc.section}`)}
          </span>
        </nav>

        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-bold">{doc.title}</h1>
            <DocsStatusBadge status={doc.status} />
          </div>
          {doc.description && (
            <p className="mt-3 text-lg text-gray-600">{doc.description}</p>
          )}
          {doc.isFallback && (
            <p className="mt-4 rounded-lg border border-gray-200 border-dashed px-4 py-2 text-sm text-gray-600">
              {t("fallbackNotice")}
            </p>
          )}
        </header>

        <DocsMarkdown content={doc.content} />

        {related.length > 0 && (
          <section className="mt-12 border-t border-gray-200 pt-8">
            <h2 className="mb-4 text-lg font-semibold">{t("related")}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {related.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/docs/${page.slug}`}
                    className="block rounded-xl border border-gray-200 p-4 transition-colors hover:border-blue-500"
                  >
                    <span className="font-medium">{page.title}</span>
                    {page.description && (
                      <span className="mt-1 block text-sm text-gray-600">
                        {page.description}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(previous || next) && (
          <nav className="mt-12 flex flex-col gap-3 border-t border-gray-200 pt-8 sm:flex-row">
            {previous && (
              <PagerLink
                doc={previous}
                direction="previous"
                label={t("pager.previous")}
              />
            )}
            {next && (
              <PagerLink doc={next} direction="next" label={t("pager.next")} />
            )}
          </nav>
        )}

        {doc.updated && (
          <p className="mt-8 text-xs text-gray-600">
            {t("lastUpdated", { date: doc.updated })}
          </p>
        )}
      </article>

      <DocsToc headings={doc.headings} />
    </div>
  );
}
