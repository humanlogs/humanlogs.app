import fs from "fs";
import path from "path";

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  description: string;
  author: string;
  tags: string[];
  coverImage?: string;
  content: string;
}

export type BlogPostMeta = Omit<BlogPost, "content">;

const BLOG_PATH = path.join(process.cwd(), "content", "blog");

function parseFrontmatter(raw: string): { data: Record<string, string>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
    data[key] = value;
  }

  return { data, content: match[2] };
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  // Handle both "tag1, tag2" and "[tag1, tag2]" forms
  return raw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

export function getAllBlogPosts(): BlogPostMeta[] {
  try {
    if (!fs.existsSync(BLOG_PATH)) return [];

    const files = fs.readdirSync(BLOG_PATH).filter((f) => f.endsWith(".md"));

    const posts = files
      .map((file) => {
        const raw = fs.readFileSync(path.join(BLOG_PATH, file), "utf-8");
        const { data } = parseFrontmatter(raw);
        const slug = data.slug ?? file.replace(/\.md$/, "");

        return {
          slug,
          title: data.title ?? slug,
          date: data.date ?? "",
          description: data.description ?? "",
          author: data.author ?? "HumanLogs Team",
          tags: parseTags(data.tags),
          coverImage: data.coverImage,
        } satisfies BlogPostMeta;
      })
      .filter((p) => p.date);

    return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}

export function getBlogPost(slug: string): BlogPost | null {
  try {
    if (!fs.existsSync(BLOG_PATH)) return null;

    const files = fs.readdirSync(BLOG_PATH).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const raw = fs.readFileSync(path.join(BLOG_PATH, file), "utf-8");
      const { data, content } = parseFrontmatter(raw);
      const postSlug = data.slug ?? file.replace(/\.md$/, "");

      if (postSlug === slug) {
        return {
          slug: postSlug,
          title: data.title ?? postSlug,
          date: data.date ?? "",
          description: data.description ?? "",
          author: data.author ?? "HumanLogs Team",
          tags: parseTags(data.tags),
          coverImage: data.coverImage,
          content,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function getAllBlogSlugs(): string[] {
  return getAllBlogPosts().map((p) => p.slug);
}
