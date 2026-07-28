import { NextResponse } from "next/server";
import { getDocsSearchCorpus } from "@/lib/utils/docs-utils";
import { locales, type Locale } from "@/lib/utils/i18n";

/**
 * Full text of the documentation, per locale, for the sidebar search.
 *
 * Static: the corpus is markdown in the repository, so this is generated at
 * build time and served from the cache — no database, no session, nothing to
 * rate limit. The client fetches it once, the first time someone searches.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    return NextResponse.json({ error: "Unknown locale" }, { status: 404 });
  }

  return NextResponse.json({
    documents: getDocsSearchCorpus(locale as Locale),
  });
}
