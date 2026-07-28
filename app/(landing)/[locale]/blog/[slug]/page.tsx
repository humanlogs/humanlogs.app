import { MarkdownViewer } from "@/components/markdown-viewer";
import { getAllBlogPosts, getAllBlogSlugs, getBlogPost } from "@/lib/utils/blog-utils";
import { Calendar, ChevronLeft, Tag, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CTASection } from "../../components/sections";

export async function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} - HumanLogs Blog`,
    description: post.description,
  };
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const post = getBlogPost(slug);

  if (!post) notFound();

  const allPosts = getAllBlogPosts().filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <>
      <div className="container mx-auto max-w-3xl py-16 px-6">
        <Link
          href={`/${locale}/blog`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ChevronLeft className="h-4 w-4" />
          {locale === "fr" ? "Retour au blog" : "Back to Blog"}
        </Link>

        <article>
          <header className="mb-10">
            <h1 className="text-4xl font-bold mb-6 leading-tight">{post.title}</h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(post.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {post.author}
              </span>
            </div>

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
          </header>

          <MarkdownViewer content={post.content} />
        </article>

        <div className="mt-16 pt-8 border-t">
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {locale === "fr" ? "Retour au blog" : "Back to Blog"}
          </Link>
        </div>
      </div>

      {allPosts.length > 0 && (
        <section className="bg-gray-50 border-t py-16">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-black mb-8">
                {locale === "fr" ? "Plus d'articles" : "More Articles"}
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                {allPosts.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/${locale}/blog/${p.slug}`}
                    className="group block p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all"
                  >
                    <p className="text-xs text-muted-foreground mb-2">
                      {formatDate(p.date)}
                    </p>
                    <h3 className="font-semibold text-base text-black mb-2 group-hover:text-blue-600 transition-colors leading-snug">
                      {p.title}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {p.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <CTASection translationKey="cta" />
    </>
  );
}
