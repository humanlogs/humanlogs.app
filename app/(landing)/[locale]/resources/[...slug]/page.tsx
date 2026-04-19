import { MarkdownViewer } from "@/components/markdown-viewer";
import { getAllDocPaths, getDocContent } from "@/lib/utils/docs-utils";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Locale } from "@/lib/utils/i18n";

export async function generateStaticParams() {
  const paths = getAllDocPaths();
  return paths.map((path) => ({
    slug: path.split("/"),
  }));
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const locale = (await getLocale()) as Locale;
  const docPath = slug.join("/");

  const doc = getDocContent(docPath, locale);

  if (!doc) {
    notFound();
  }

  return (
    <div className="container max-w-4xl py-12 px-6">
      <article>
        <h1 className="text-4xl font-bold mb-8">{doc.title}</h1>
        <MarkdownViewer content={doc.content} />
      </article>
    </div>
  );
}
