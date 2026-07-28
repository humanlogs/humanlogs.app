"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { DocsStatusBadge } from "@/components/docs/docs-status-badge";
import { sectionColor } from "@/components/docs/docs-section-color";
import type {
  DocSearchDocument,
  DocSearchEntry,
  DocSection,
  DocStatus,
} from "@/lib/utils/docs-utils";
import { locales, type Locale } from "@/lib/utils/i18n";
import { cn } from "@/lib/utils/utils";

/**
 * Sidebar and search are the same component on purpose: with a corpus this
 * size, "search" is filtering the navigation you are already looking at. It
 * needs no index server and no third party.
 *
 * Two indexes back it. The small one (titles, descriptions, headings) is
 * rendered with the page, so the first keystroke filters instantly. The full
 * text is fetched once, the first time the field is used — inlining the whole
 * corpus in every documentation page would make everyone pay for the minority
 * who search.
 */

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** The matching sentence, trimmed around the hit, to show under the title. */
function excerptAround(text: string, needle: string): string | null {
  const at = normalize(text).indexOf(needle);
  if (at === -1) return null;

  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, at + needle.length + 60);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function SidebarLink({
  href,
  label,
  status,
  active,
  excerpt,
  onNavigate,
}: {
  href: string;
  label: string;
  status: DocStatus;
  active: boolean;
  excerpt?: string | null;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "block rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-gray-100",
        active && "bg-gray-100 font-medium text-black",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <DocsStatusBadge status={status} />
      </span>
      {excerpt && (
        <span className="mt-0.5 block text-xs leading-snug text-gray-500">
          {excerpt}
        </span>
      )}
    </Link>
  );
}

/** `/fr/docs/transcribe/navigation` and `/docs/transcribe/navigation` are the same page. */
function currentSlug(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && locales.includes(segments[0])) segments.shift();
  if (segments[0] === "docs") segments.shift();
  return segments.join("/");
}

export function DocsSidebar({
  sections,
  searchIndex,
  locale,
}: {
  sections: DocSection[];
  searchIndex: DocSearchEntry[];
  locale: Locale;
}) {
  const t = useTranslations("docs");
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [openOnMobile, setOpenOnMobile] = useState(false);
  const [corpus, setCorpus] = useState<DocSearchDocument[] | null>(null);
  const [wantsCorpus, setWantsCorpus] = useState(false);

  // Focusing the field is the cue to prefetch, but never the only one: a
  // pasted or restored value never fires focus, and search would then quietly
  // stop reaching into page bodies.
  const needsCorpus = wantsCorpus || query.trim().length > 0;

  useEffect(() => {
    if (!needsCorpus || corpus) return;

    let cancelled = false;
    fetch(`/api/docs/${locale}/search-index`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        // Failing to load it is not worth surfacing: search keeps working on
        // titles and headings, it just stops reaching into page bodies.
        if (!cancelled && data?.documents) setCorpus(data.documents);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [needsCorpus, corpus, locale]);

  const active = currentSlug(pathname);
  const needle = normalize(query.trim());

  const excerpts = new Map<string, string>();
  let matches: Set<string> | null = null;

  if (needle) {
    matches = new Set(
      searchIndex
        .filter((entry) =>
          normalize(
            `${entry.title} ${entry.description} ${entry.keywords} ${entry.slug}`,
          ).includes(needle),
        )
        .map((entry) => entry.slug),
    );

    for (const document of corpus ?? []) {
      // Pages already matched on their title need no excerpt — the reason they
      // are in the list is visible.
      if (matches.has(document.slug)) continue;
      const excerpt = excerptAround(document.text, needle);
      if (excerpt) {
        matches.add(document.slug);
        excerpts.set(document.slug, excerpt);
      }
    }
  }

  const visible = sections
    .map((section) => ({
      ...section,
      pages: matches
        ? section.pages.filter((page) => matches.has(page.slug))
        : section.pages,
    }))
    .filter((section) => section.pages.length > 0);

  return (
    <div className="h-max w-full lg:flex lg:w-68 lg:flex-shrink-0 lg:flex-col">
      <button
        type="button"
        onClick={() => setOpenOnMobile((open) => !open)}
        className="mb-3 flex w-full items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium lg:hidden"
      >
        {openOnMobile ? (
          <X className="h-4 w-4" />
        ) : (
          <Menu className="h-4 w-4" />
        )}
        {t("nav.title")}
      </button>

      {/* A floating card rather than a full-height rail: the documentation is a
          section of the marketing site, not an application shell. It grows to
          the height of the page instead of scrolling inside itself — with
          twenty pages the whole nav fits, and an inner scrollbar would only
          add a second thing to scroll. */}
      <nav
        aria-label={t("nav.title")}
        className={cn(
          "rounded-2xl border border-gray-200 bg-white p-3",
          "lg:block lg:flex-1",
          openOnMobile ? "block" : "hidden",
        )}
      >
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setWantsCorpus(true)}
            placeholder={t("nav.searchPlaceholder")}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {visible.length === 0 && (
          <p className="px-3 py-6 text-sm text-gray-600">
            {t("nav.noResults")}
          </p>
        )}

        <div className="space-y-6">
          {visible.map((section) => {
            const color = sectionColor(section.slug);

            return (
              <div key={section.slug}>
                <p className="mb-1 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  <span
                    aria-hidden
                    className={cn("h-2 w-2 rounded-full", color.dot)}
                  />
                  {t(`sections.${section.slug}`)}
                  <DocsStatusBadge status={section.status} />
                </p>
                <ul className={cn("ml-4 border-l-2 pl-1", color.rule)}>
                  {section.pages.map((page) => (
                    <li key={page.slug}>
                      <SidebarLink
                        href={`/docs/${page.slug}`}
                        label={page.title}
                        // A page badge inside an already-labelled section would
                        // just repeat it.
                        status={
                          page.status === section.status ? "live" : page.status
                        }
                        active={active === page.slug}
                        excerpt={excerpts.get(page.slug)}
                        onNavigate={() => setOpenOnMobile(false)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
