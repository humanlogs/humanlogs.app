import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { getDocsNav, getDocsSearchIndex } from "@/lib/utils/docs-utils";
import type { Locale } from "@/lib/utils/i18n";

export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const sections = getDocsNav(locale as Locale);
  const searchIndex = getDocsSearchIndex(locale as Locale);

  // `bg-white text-black`: the marketing site is light-only, but `<html>` may
  // carry the app's `dark` class when the visitor's OS prefers dark.
  return (
    <div className="bg-white text-black">
      {/* Same container as the landing header, so the docs line up with the
          rest of the site rather than defining their own width. */}
      <div className="container mx-auto flex flex-col gap-8 px-4 py-10 md:px-6 lg:flex-row lg:items-stretch">
        <DocsSidebar
          sections={sections}
          searchIndex={searchIndex}
          locale={locale as Locale}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
