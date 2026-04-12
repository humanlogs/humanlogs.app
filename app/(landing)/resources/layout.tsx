import { DocsSidebar } from "@/components/docs-sidebar";
import { getDocsStructure } from "@/lib/utils/docs-utils";

export default function ResourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const docsStructure = getDocsStructure();

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <DocsSidebar structure={docsStructure} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
