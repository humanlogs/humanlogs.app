import fs from "fs";
import path from "path";
import type { Locale } from "./i18n";

export interface DocItem {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: DocItem[];
}

const DOCS_PATH = path.join(process.cwd(), "docs");

/**
 * Get the document structure from the docs folder
 */
export function getDocsStructure(): DocItem[] {
  function buildStructure(dir: string, basePath: string = ""): DocItem[] {
    const items: DocItem[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files and localized versions (they'll be handled separately)
        if (entry.name.startsWith(".") || entry.name.match(/_[a-z]{2}\.md$/)) {
          continue;
        }

        const itemPath = path.join(dir, entry.name);
        const relativePath = basePath
          ? `${basePath}/${entry.name}`
          : entry.name;

        if (entry.isDirectory()) {
          items.push({
            name: entry.name,
            path: relativePath,
            type: "folder",
            children: buildStructure(itemPath, relativePath),
          });
        } else if (entry.name.endsWith(".md")) {
          items.push({
            name: entry.name.replace(".md", ""),
            path: relativePath.replace(".md", ""),
            type: "file",
          });
        }
      }
    } catch (error) {
      console.error("Error reading docs directory:", error);
    }

    // Sort: folders first, then files, alphabetically
    return items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  return buildStructure(DOCS_PATH);
}

/**
 * Get the content of a specific document, checking for localized version first
 */
export function getDocContent(
  docPath: string,
  locale: Locale = "en",
): { content: string; title: string } | null {
  try {
    const basePath = path.join(DOCS_PATH, docPath);

    // Try localized version first (e.g., AUTH_SETUP_fr.md)
    const localizedPath = `${basePath}_${locale}.md`;
    const defaultPath = `${basePath}.md`;

    let filePath: string;
    if (locale !== "en" && fs.existsSync(localizedPath)) {
      filePath = localizedPath;
    } else if (fs.existsSync(defaultPath)) {
      filePath = defaultPath;
    } else {
      return null;
    }

    const content = fs.readFileSync(filePath, "utf-8");

    // Extract title from first heading or use filename
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch
      ? titleMatch[1]
      : path.basename(docPath).replace(/_/g, " ");

    return { content, title };
  } catch (error) {
    console.error("Error reading doc file:", error);
    return null;
  }
}

/**
 * Get all available doc paths for navigation
 */
export function getAllDocPaths(): string[] {
  const paths: string[] = [];

  function traverse(items: DocItem[], prefix: string = "") {
    for (const item of items) {
      if (item.type === "file") {
        paths.push(item.path);
      } else if (item.children) {
        traverse(item.children, item.path);
      }
    }
  }

  traverse(getDocsStructure());
  return paths;
}
