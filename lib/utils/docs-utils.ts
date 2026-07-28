import fs from "fs";
import path from "path";
import { parseFrontmatter, parseList } from "./frontmatter";
import { extractHeadings, type DocHeading } from "./docs-headings";
import type { Locale } from "./i18n";

/**
 * The product documentation served under `/[locale]/docs`.
 *
 * Two rules keep this cheap to maintain:
 *
 * 1. **The English tree is the structure.** `content/docs/en/**` decides which
 *    pages exist, in which section and in which order. A translation only ever
 *    supplies content: `content/docs/fr/<same-path>.md`. A missing translation
 *    silently falls back to English rather than 404ing, so translating is
 *    always incremental and never blocking.
 * 2. **Nothing here is hand-registered.** Adding a page = adding a file. The
 *    only ordering knob outside the files themselves is
 *    `content/docs/sections.json`, which lists sections top to bottom.
 *
 * Section titles are *not* in the markdown: they live in `messages/<locale>/
 * docs.json` under `docs.sections.<slug>`, so the sidebar is translated by the
 * same workflow as the rest of the app.
 */

export { extractHeadings, slugifyHeading } from "./docs-headings";
export type { DocHeading } from "./docs-headings";

const DOCS_ROOT = path.join(process.cwd(), "content", "docs");
const SOURCE_LOCALE = "en";

/** Lifecycle of a documented feature — rendered as a badge next to its title. */
export type DocStatus = "live" | "beta" | "soon";

const STATUSES: DocStatus[] = ["live", "beta", "soon"];

export interface DocMeta {
  /** `getting-started/quickstart` — the URL path after `/docs`. */
  slug: string;
  section: string;
  title: string;
  description: string;
  status: DocStatus;
  order: number;
  updated?: string;
}

export interface DocSection {
  slug: string;
  order: number;
  /** Derived: a section is `beta`/`soon` when every page in it is. */
  status: DocStatus;
  pages: DocMeta[];
}

export interface Doc extends DocMeta {
  content: string;
  headings: DocHeading[];
  /** Other doc slugs to surface at the bottom of the page. */
  related: string[];
  /** True when the reader asked for a locale we have no translation for. */
  isFallback: boolean;
}

function readSectionOrder(): string[] {
  try {
    const raw = fs.readFileSync(path.join(DOCS_ROOT, "sections.json"), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function localeDir(locale: string): string {
  return path.join(DOCS_ROOT, locale);
}

/** Every markdown file of the source locale, as `section/page` slugs. */
function listSourceSlugs(): string[] {
  const root = localeDir(SOURCE_LOCALE);
  const slugs: string[] = [];

  const walk = (dir: string, prefix: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
      const next = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), next);
      } else if (entry.name.endsWith(".md")) {
        slugs.push(next.replace(/\.md$/, ""));
      }
    }
  };

  walk(root, "");
  return slugs;
}

function resolveFile(slug: string, locale: string): string | null {
  const candidates =
    locale === SOURCE_LOCALE
      ? [path.join(localeDir(SOURCE_LOCALE), `${slug}.md`)]
      : [
          path.join(localeDir(locale), `${slug}.md`),
          path.join(localeDir(SOURCE_LOCALE), `${slug}.md`),
        ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function toStatus(raw: string | undefined): DocStatus {
  return STATUSES.includes(raw as DocStatus) ? (raw as DocStatus) : "live";
}

function readMeta(slug: string, locale: string): DocMeta | null {
  const file = resolveFile(slug, locale);
  if (!file) return null;

  const { data } = parseFrontmatter(fs.readFileSync(file, "utf-8"));
  const order = Number(data.order);

  return {
    slug,
    section: slug.split("/")[0],
    title: data.title || slug.split("/").pop()!.replace(/-/g, " "),
    description: data.description || "",
    status: toStatus(data.status),
    order: Number.isFinite(order) ? order : 999,
    updated: data.updated,
  };
}

/** The full sidebar tree for a locale, sections and pages already ordered. */
export function getDocsNav(locale: Locale): DocSection[] {
  const sectionOrder = readSectionOrder();
  const bySection = new Map<string, DocMeta[]>();

  for (const slug of listSourceSlugs()) {
    const meta = readMeta(slug, locale);
    if (!meta) continue;
    const pages = bySection.get(meta.section) ?? [];
    pages.push(meta);
    bySection.set(meta.section, pages);
  }

  return [...bySection.entries()]
    .map(([slug, pages]) => {
      const declared = sectionOrder.indexOf(slug);
      const ordered = pages.sort(
        (a, b) => a.order - b.order || a.title.localeCompare(b.title),
      );
      return {
        slug,
        // Undeclared sections sort after the declared ones instead of
        // disappearing, so a new folder shows up even before it is listed.
        order: declared === -1 ? sectionOrder.length : declared,
        // A section is labelled only when nothing in it has shipped; its first
        // page then sets the label, so a beta feature whose later pages are
        // still `soon` reads as beta rather than as two contradictory badges.
        // One unfinished page inside a shipped section stays the page's business.
        status: ordered.every((page) => page.status !== "live")
          ? ordered[0].status
          : "live",
        pages: ordered,
      };
    })
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

export function getDoc(slug: string, locale: Locale): Doc | null {
  const file = resolveFile(slug, locale);
  const meta = readMeta(slug, locale);
  if (!file || !meta) return null;

  const { data, content } = parseFrontmatter(fs.readFileSync(file, "utf-8"));

  return {
    ...meta,
    content,
    headings: extractHeadings(content),
    related: parseList(data.related),
    isFallback:
      locale !== SOURCE_LOCALE &&
      !fs.existsSync(path.join(localeDir(locale), `${slug}.md`)),
  };
}

/** Slugs as path segments, for `generateStaticParams`. */
export function getAllDocSlugs(): string[][] {
  return listSourceSlugs().map((slug) => slug.split("/"));
}

/** Flat, ordered reading order — what "previous / next" walks through. */
export function getOrderedDocs(locale: Locale): DocMeta[] {
  return getDocsNav(locale).flatMap((section) => section.pages);
}

export function getDocPager(
  slug: string,
  locale: Locale,
): { previous: DocMeta | null; next: DocMeta | null } {
  const ordered = getOrderedDocs(locale);
  const index = ordered.findIndex((doc) => doc.slug === slug);
  if (index === -1) return { previous: null, next: null };

  return {
    previous: ordered[index - 1] ?? null,
    next: ordered[index + 1] ?? null,
  };
}

export interface DocSearchEntry {
  slug: string;
  section: string;
  title: string;
  description: string;
  /** Headings only — enough to find a page without shipping the whole corpus. */
  keywords: string;
}

/**
 * The index rendered with the page: small enough to inline, so typing filters
 * the navigation instantly, before the full-text index has been fetched.
 */
export function getDocsSearchIndex(locale: Locale): DocSearchEntry[] {
  return getOrderedDocs(locale).map((meta) => {
    const doc = getDoc(meta.slug, locale);
    return {
      slug: meta.slug,
      section: meta.section,
      title: meta.title,
      description: meta.description,
      keywords: (doc?.headings ?? []).map((h) => h.text).join(" "),
    };
  });
}

/** Markdown reduced to the words a reader would see — no syntax, no urls. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/\|/g, " ")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface DocSearchDocument {
  slug: string;
  text: string;
}

/**
 * Full page text, served separately from the page (see the
 * `/api/docs/[locale]/search-index` route) and fetched the first time someone
 * uses the search field. Inlining it would put the whole corpus in the payload
 * of every documentation page, for the minority of readers who search.
 */
export function getDocsSearchCorpus(locale: Locale): DocSearchDocument[] {
  return getOrderedDocs(locale).map((meta) => ({
    slug: meta.slug,
    text: stripMarkdown(getDoc(meta.slug, locale)?.content ?? ""),
  }));
}
