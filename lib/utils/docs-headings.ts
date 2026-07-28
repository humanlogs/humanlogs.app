/**
 * Heading anchors, kept in their own module because the renderer that builds
 * them runs in the browser: `docs-utils` reads the filesystem, and importing it
 * from a client component would drag `fs` into the bundle.
 *
 * The table of contents and the rendered anchors must agree exactly, which is
 * why both sides call `slugifyHeading` rather than each rolling their own.
 */

export interface DocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** `##` and `###` headings, ignoring anything inside a fenced code block. */
export function extractHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  let inFence = false;

  for (const line of markdown.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!match) continue;

    const text = match[2].replace(/[*_`]/g, "");
    headings.push({
      id: slugifyHeading(text),
      text,
      level: match[1].length as 2 | 3,
    });
  }

  return headings;
}
