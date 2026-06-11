/**
 * Removes common AI writing artifacts from blog markdown files.
 * Runs before deployment; rewrites files in-place and reports changes.
 * Does not modify YAML frontmatter.
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

const BLOG_DIR = "content/blog";

// Each entry: [regex, replacement]
// Ordered from most to least aggressive.
const REPLACEMENTS = [
  // Filler sentence openers — just delete them
  [/\bIt(?:'s| is) worth noting that /gi, ""],
  [/\bIt(?:'s| is) important to note that /gi, ""],
  [/\bIt should be noted that /gi, ""],
  [/\bNeedless to say,? /gi, ""],
  [/\bAs (?:we|I) can see,? /gi, ""],
  [/\bAs (?:previously|earlier) mentioned,? /gi, "As noted, "],
  [/\bIn conclusion,? /gi, ""],
  [/\bIn summary,? /gi, ""],
  [/\bTo summarize,? /gi, ""],

  // Buzzwords with clean substitutes
  [/\butilize\b/gi, "use"],
  [/\butilizes\b/gi, "uses"],
  [/\butilized\b/gi, "used"],
  [/\butilizing\b/gi, "using"],
  [/\butili[sz]ation\b/gi, "use"],
  [/\bdelve(?:s)? into\b/gi, "explore"],
  [/\bdelving into\b/gi, "exploring"],

  // Double-space cleanup after deletions
  [/  +/g, " "],
  // Leading space at start of line after deletion
  [/^ /gm, ""],
  // Empty lines introduced by deletions (3+ newlines → 2)
  [/\n{3,}/g, "\n\n"],
];

function splitFrontmatter(content) {
  // Only process the body — leave YAML frontmatter untouched
  const match = content.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
  if (match) return { frontmatter: match[1], body: match[2] };
  return { frontmatter: "", body: content };
}

async function cleanFile(filePath) {
  const raw = await readFile(filePath, "utf-8");
  const { frontmatter, body } = splitFrontmatter(raw);

  let cleaned = body;
  for (const [pattern, replacement] of REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  const result = frontmatter + cleaned;
  if (result === raw) return false;

  await writeFile(filePath, result, "utf-8");
  return true;
}

async function main() {
  let files;
  try {
    files = (await readdir(BLOG_DIR)).filter((f) => f.endsWith(".md"));
  } catch {
    console.error(`Directory not found: ${BLOG_DIR}`);
    process.exit(1);
  }

  let changed = 0;
  for (const file of files) {
    const wasChanged = await cleanFile(join(BLOG_DIR, file));
    if (wasChanged) {
      console.log(`  cleaned: ${file}`);
      changed++;
    }
  }

  if (changed === 0) {
    console.log("No AI artifacts found in blog content.");
  } else {
    console.log(`\n${changed} file(s) updated.`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
