/**
 * Minimal YAML-ish front-matter parser.
 *
 * Deliberately not a YAML dependency: the front-matter we write in `content/**`
 * is a flat `key: value` block, and the blog has been parsing it this way since
 * the start. Anything that needs nesting belongs in a JSON file next to the
 * markdown, not in the header.
 */
export function parseFrontmatter(raw: string): {
  data: Record<string, string>;
  content: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line
      .slice(colon + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    data[key] = value;
  }

  return { data, content: match[2] };
}

/** Accepts both `a, b` and `[a, b]`. */
export function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}
