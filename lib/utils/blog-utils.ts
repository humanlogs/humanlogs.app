import fs from "fs";
import path from "path";
import { parseFrontmatter, parseList } from "./frontmatter";

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  description: string;
  author: string;
  tags: string[];
  coverImage?: string;
  locale: string;
  content: string;
}

export type BlogPostMeta = Omit<BlogPost, "content">;

const BLOG_PATH = path.join(process.cwd(), "content", "blog");

/** Handles both `tag1, tag2` and `[tag1, tag2]` forms. */
const parseTags = parseList;

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
          locale: data.locale ?? "en",
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
          locale: data.locale ?? "en",
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
