/**
 * Remove AI writing artefacts from MDX/MD files before publishing.
 *
 *   npm run clean -- content/blog/my-article.mdx
 *   npm run clean -- content/blog/*.mdx      # glob
 *
 * Code blocks (``` fences) are never modified.
 * Prints a summary of every fix applied.
 */
import { readFile, writeFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

interface Fix {
  pattern: RegExp;
  replacement: string;
  label: string;
}

const FIXES: Fix[] = [
  // Em dashes (spaced or unspaced) → comma separator
  { pattern: /\s*—\s*/g, replacement: ", ", label: "em dash removed" },
  // En dashes (spaced or unspaced) → simple hyphen
  { pattern: /\s*–\s*/g, replacement: " - ", label: "en dash removed" },
  // Curly/smart double quotes → straight (MDX safe)
  { pattern: /[""]/g, replacement: '"', label: "smart double quotes" },
  // Smart apostrophes between word characters only
  { pattern: /(\w)[''](\w)/g, replacement: "$1'$2", label: "smart apostrophes" },
  // Ellipsis character → three dots
  { pattern: /…/g, replacement: "...", label: "ellipsis character" },
  // Double hyphens → single hyphen (negative lookaround protects --- YAML fences)
  { pattern: /(?<!-)--(?!-)/g, replacement: "-", label: "double hyphens" },
  // Double spaces (not at line start — preserves indentation)
  { pattern: /([^\n ]) {2,}/g, replacement: "$1 ", label: "double spaces" },
  // Trailing whitespace
  { pattern: /[ \t]+$/gm, replacement: "", label: "trailing whitespace" },
  // Filler opener phrases at start of paragraph
  {
    pattern: /^(It'?s worth noting that|It is worth noting that|As we can see,?|In conclusion,?|In today'?s world,?),?\s*/gim,
    replacement: "",
    label: "filler opener",
  },
];

/**
 * Split content into alternating [prose, code, prose, code, ...] segments.
 * Code fences (``` or ~~~) are returned as-is; prose segments get fixes applied.
 */
function splitSegments(content: string): { text: string; isCode: boolean }[] {
  const segments: { text: string; isCode: boolean }[] = [];
  const fenceRe = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(content)) !== null) {
    if (match.index > last) {
      segments.push({ text: content.slice(last, match.index), isCode: false });
    }
    segments.push({ text: match[0], isCode: true });
    last = match.index + match[0].length;
  }
  if (last < content.length) {
    segments.push({ text: content.slice(last), isCode: false });
  }
  return segments;
}

async function cleanFile(filePath: string): Promise<void> {
  const original = await readFile(filePath, "utf8");
  const segments = splitSegments(original);
  const applied = new Set<string>();

  const cleaned = segments.map((seg) => {
    if (seg.isCode) return seg.text;
    let text = seg.text;
    for (const fix of FIXES) {
      const before = text;
      text = text.replace(fix.pattern, fix.replacement);
      if (text !== before) applied.add(fix.label);
    }
    return text;
  });

  const result = cleaned.join("");

  if (result === original) {
    console.log(`  ✓ ${filePath} — no changes`);
    return;
  }

  await writeFile(filePath, result, "utf8");
  console.log(`  ✎ ${filePath}`);
  for (const label of applied) console.log(`      fixed: ${label}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Usage: npm run clean -- <file.mdx> [file2.mdx ...]");
    process.exit(1);
  }

  const files: string[] = [];
  for (const arg of args) {
    if (arg.includes("*")) {
      for await (const f of glob(arg)) files.push(f);
    } else {
      files.push(arg);
    }
  }

  if (!files.length) { console.log("No files matched."); return; }

  console.log(`\nCleaning ${files.length} file(s)...\n`);
  for (const f of files) await cleanFile(f);
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
