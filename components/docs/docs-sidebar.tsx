"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { DocsStatusBadge } from "@/components/docs/docs-status-badge";
import type { DocSearchEntry, DocSection } from "@/lib/utils/docs-utils";
import { locales } from "@/lib/utils/i18n";
import { cn } from "@/lib/utils/utils";

/**
 * Sidebar and search are the same component on purpose: with a corpus this
 * size, "search" is filtering the navigation you are already looking at. It
 * needs no index server, no third party, and it cannot go stale.
 */

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** `/fr/docs/edit/editor-tour` and `/docs/edit/editor-tour` are the same page. */
function currentSlug(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && locales.includes(segments[0])) segments.shift();
  if (segments[0] === "docs") segments.shift();
  return segments.join("/");
}

export function DocsSidebar({
  sections,
  searchIndex,
}: {
  sections: DocSection[];
  searchIndex: DocSearchEntry[];
}) {
  const t = useTranslations("docs");
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [openOnMobile, setOpenOnMobile] = useState(false);

  const active = currentSlug(pathname);
  const needle = normalize(query.trim());

  const matches = needle
    ? new Set(
        searchIndex
          .filter((entry) =>
            normalize(
              `${entry.title} ${entry.description} ${entry.keywords} ${entry.slug}`,
            ).includes(needle),
          )
          .map((entry) => entry.slug),
      )
    : null;

  const visible = sections
    .map((section) => ({
      ...section,
      pages: matches
        ? section.pages.filter((page) => matches.has(page.slug))
        : section.pages,
    }))
    .filter((section) => section.pages.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenOnMobile((open) => !open)}
        className="lg:hidden flex items-center gap-2 w-full border-b px-6 py-3 text-sm font-medium"
      >
        {openOnMobile ? (
          <X className="h-4 w-4" />
        ) : (
          <Menu className="h-4 w-4" />
        )}
        {t("nav.title")}
      </button>

      <nav
        aria-label={t("nav.title")}
        className={cn(
          "lg:block lg:w-72 lg:flex-shrink-0 lg:border-r lg:overflow-y-auto lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]",
          "px-4 py-6",
          openOnMobile ? "block border-b" : "hidden",
        )}
      >
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("nav.searchPlaceholder")}
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {visible.length === 0 && (
          <p className="px-3 py-6 text-sm text-muted-foreground">
            {t("nav.noResults")}
          </p>
        )}

        <div className="space-y-6">
          {visible.map((section) => (
            <div key={section.slug}>
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`sections.${section.slug}`)}
              </p>
              <ul>
                {section.pages.map((page) => (
                  <li key={page.slug}>
                    <Link
                      href={`/docs/${page.slug}`}
                      onClick={() => setOpenOnMobile(false)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-accent",
                        active === page.slug &&
                          "bg-accent font-medium text-foreground",
                      )}
                    >
                      <span>{page.title}</span>
                      <DocsStatusBadge status={page.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
