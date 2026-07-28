import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  extractHeadings,
  getAllDocSlugs,
  getDoc,
  getDocsNav,
  getDocsSearchCorpus,
  slugifyHeading,
  stripMarkdown,
} from "@/lib/utils/docs-utils";
import { locales, type Locale } from "@/lib/utils/i18n";

/**
 * The documentation is markdown in the repo, which makes it cheap to write and
 * easy to break silently: a typo in a slug produces a dead link, a missing
 * section title produces a raw translation key in the sidebar, and nothing
 * fails until a reader hits the page.
 *
 * These tests are the guard rail. They are content tests, not unit tests —
 * they run against the real `content/docs` tree.
 */

const DOCS_ROOT = path.join(process.cwd(), "content", "docs");
const SOURCE = "en";
const STATUSES = ["live", "beta", "soon"];

const slugs = getAllDocSlugs().map((segments) => segments.join("/"));
const sectionOrder: string[] = JSON.parse(
  fs.readFileSync(path.join(DOCS_ROOT, "sections.json"), "utf-8"),
);

function messagesFor(locale: string): Record<string, string> {
  const file = path.join(process.cwd(), "messages", locale, "docs.json");
  return JSON.parse(fs.readFileSync(file, "utf-8")).docs.sections;
}

function translationFiles(locale: string): string[] {
  const root = path.join(DOCS_ROOT, locale);
  if (!fs.existsSync(root)) return [];

  const found: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), next);
      else if (entry.name.endsWith(".md")) found.push(next.replace(/\.md$/, ""));
    }
  };
  walk(root, "");
  return found;
}

describe("docs front-matter", () => {
  it("finds pages to check", () => {
    expect(slugs.length).toBeGreaterThan(0);
  });

  it.each(slugs)("%s declares a title, description and valid status", (slug) => {
    const doc = getDoc(slug, SOURCE);
    expect(doc).not.toBeNull();
    expect(doc!.title.trim()).not.toBe("");
    expect(doc!.description.trim()).not.toBe("");
    expect(STATUSES).toContain(doc!.status);
    // `order` defaults to 999, which would silently dump the page at the
    // bottom of its section instead of where the author meant it to be.
    expect(doc!.order).toBeLessThan(999);
  });

  it.each(slugs)("%s lives in a declared section", (slug) => {
    expect(sectionOrder).toContain(slug.split("/")[0]);
  });
});

describe("docs navigation", () => {
  it("orders sections as declared in sections.json", () => {
    const nav = getDocsNav(SOURCE);
    const seen = nav.map((section) => section.slug);
    expect(seen).toEqual(sectionOrder.filter((slug) => seen.includes(slug)));
  });

  it.each(locales)("has a translated title for every section in %s", (locale) => {
    const titles = messagesFor(locale);
    for (const section of getDocsNav(SOURCE)) {
      expect(titles[section.slug], `missing docs.sections.${section.slug}`).toBeTruthy();
    }
  });
});

describe("docs links", () => {
  const internalLinks = slugs.flatMap((slug) => {
    const doc = getDoc(slug, SOURCE)!;
    return [
      ...[...doc.content.matchAll(/\]\((\/[^)#\s]*)/g)].map((m) => m[1]),
      ...doc.related.map((target) => `/docs/${target}`),
    ].map((href) => ({ slug, href }));
  });

  it("finds links to check", () => {
    expect(internalLinks.length).toBeGreaterThan(0);
  });

  it.each(internalLinks.filter(({ href }) => href.startsWith("/docs")))(
    "$slug links to an existing doc page: $href",
    ({ href }) => {
      expect(slugs).toContain(href.replace(/^\/docs\/?/, ""));
    },
  );

  it("only links to site sections that exist", () => {
    // Non-docs internal links point at landing routes; a typo here is a 404
    // on a public page, so keep the set of allowed prefixes explicit.
    const allowed = [
      "/docs",
      "/legal/",
      "/tools",
      "/contact",
      "/pricing",
      "/use-cases",
      "/blog",
    ];
    const strays = internalLinks.filter(
      ({ href }) => !allowed.some((prefix) => href.startsWith(prefix)),
    );
    expect(strays).toEqual([]);
  });
});

describe("docs translations", () => {
  it.each(locales.filter((locale) => locale !== SOURCE))(
    "every %s file mirrors an English page",
    (locale) => {
      // A translation whose path does not exist in English is invisible: the
      // navigation is built from the English tree.
      expect(translationFiles(locale).filter((slug) => !slugs.includes(slug))).toEqual([]);
    },
  );

  it("falls back to English for an untranslated page", () => {
    const untranslated = slugs.find(
      (slug) => !translationFiles("fr").includes(slug),
    );
    if (!untranslated) return;

    const doc = getDoc(untranslated, "fr" as Locale);
    expect(doc).not.toBeNull();
    expect(doc!.isFallback).toBe(true);
    expect(doc!.content).toBe(getDoc(untranslated, SOURCE)!.content);
  });
});

describe("house style", () => {
  // Em dashes are a deliberate ban: they read as an affectation in a product
  // manual, and a comma or a colon always does the job.
  it.each(slugs)("%s uses no em dash", (slug) => {
    for (const locale of locales) {
      const doc = getDoc(slug, locale as Locale);
      expect(doc?.content.includes("—"), `${locale}/${slug}`).toBe(false);
      expect(doc?.title.includes("—")).toBe(false);
      expect(doc?.description.includes("—")).toBe(false);
    }
  });
});

describe("search index", () => {
  it("carries the body of every page", () => {
    const corpus = getDocsSearchCorpus(SOURCE);
    expect(corpus.map((entry) => entry.slug).sort()).toEqual([...slugs].sort());
    // Placeholder pages are short but never empty; an empty entry means the
    // page would be invisible to search.
    expect(corpus.filter((entry) => entry.text.length < 10)).toEqual([]);
  });

  it("indexes prose, not markdown syntax", () => {
    const text = stripMarkdown(
      [
        "## A heading",
        "",
        "Some **bold** text with a [link](/docs/somewhere) inside.",
        "",
        "```bash",
        "npm run secret",
        "```",
        "",
        "- a list item",
      ].join("\n"),
    );

    expect(text).toContain("A heading");
    expect(text).toContain("Some bold text with a link inside.");
    expect(text).toContain("a list item");
    expect(text).not.toContain("/docs/somewhere");
    expect(text).not.toContain("npm run secret");
  });
});

describe("heading anchors", () => {
  it("ignores headings inside code fences", () => {
    const headings = extractHeadings(
      ["## Real", "", "```bash", "# not a heading", "```", "", "### Also real"].join(
        "\n",
      ),
    );
    expect(headings.map((h) => h.text)).toEqual(["Real", "Also real"]);
  });

  it("produces stable, url-safe anchors", () => {
    expect(slugifyHeading("Où votre audio est traité")).toBe(
      "ou-votre-audio-est-traite",
    );
    expect(slugifyHeading("EU or US processing")).toBe("eu-or-us-processing");
  });

  it.each(slugs)("%s has unique heading anchors", (slug) => {
    const ids = getDoc(slug, SOURCE)!.headings.map((heading) => heading.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
