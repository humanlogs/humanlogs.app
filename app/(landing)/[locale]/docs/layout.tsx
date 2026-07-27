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

  return (
    <div className="lg:flex lg:items-start">
      <DocsSidebar sections={sections} searchIndex={searchIndex} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
