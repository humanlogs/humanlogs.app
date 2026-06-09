import { getAllBlogPosts } from "@/lib/utils/blog-utils";
import { Calendar, Tag } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Blog - HumanLogs",
  description:
    "Tips, guides, and insights on transcription, qualitative research, and audio workflows.",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  const posts = getAllBlogPosts();

  return (
    <div className="container max-w-4xl py-16 px-6">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Blog</h1>
        <p className="text-muted-foreground text-lg">
          Tips, guides, and insights on transcription, qualitative research, and
          audio workflows.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <p className="text-lg">No posts yet — check back soon.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="border rounded-xl p-6 hover:border-gray-400 transition-colors"
            >
              <Link href={`/blog/${post.slug}`} className="block group">
                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(post.date)}
                  </span>
                  <span>·</span>
                  <span>{post.author}</span>
                </div>

                <h2 className="text-xl font-semibold mb-3 group-hover:text-blue-600 transition-colors">
                  {post.title}
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-4">
                  {post.description}
                </p>

                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1"
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
