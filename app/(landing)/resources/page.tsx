import { FileText, BookOpen } from "lucide-react";
import { getDocsStructure } from "@/lib/docs-utils";
import Link from "next/link";

export default function ResourcesPage() {
  const docsStructure = getDocsStructure();

  return (
    <div className="container max-w-4xl py-12 px-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Documentation</h1>
        <p className="text-muted-foreground text-lg">
          Welcome to the documentation. Select a document from the sidebar to
          get started.
        </p>
      </div>

      <div className="grid gap-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Available Documentation
        </h2>
        {docsStructure.map((item) => (
          <div
            key={item.path}
            className="border rounded-lg p-4 hover:bg-accent transition-colors"
          >
            {item.type === "file" ? (
              <Link href={`/resources/${item.path}`} className="block">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg">
                      {item.name.replace(/_/g, " ")}
                    </h3>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="flex items-start gap-3">
                <BookOpen className="h-5 w-5 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-lg">
                    {item.name.replace(/_/g, " ")}
                  </h3>
                  <div className="mt-2 ml-4 space-y-2">
                    {item.children?.map((child) => (
                      <Link
                        key={child.path}
                        href={`/resources/${child.path}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <FileText className="h-4 w-4" />
                        {child.name.replace(/_/g, " ")}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
