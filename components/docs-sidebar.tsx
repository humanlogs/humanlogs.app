"use client";

import { ChevronRight, FileText, Folder } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState } from "react";
import type { DocItem } from "@/lib/docs-utils";
import { cn } from "@/lib/utils";

interface DocsSidebarProps {
  structure: DocItem[];
}

function DocTreeItem({
  item,
  currentPath,
}: {
  item: DocItem;
  currentPath: string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (item.type === "file") {
    const isActive = currentPath === `/resources/${item.path}`;
    return (
      <Link
        href={`/resources/${item.path}`}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors",
          isActive && "bg-accent font-medium",
        )}
      >
        <FileText className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{item.name.replace(/_/g, " ")}</span>
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors w-full"
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 flex-shrink-0 transition-transform",
            isOpen && "rotate-90",
          )}
        />
        <Folder className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{item.name.replace(/_/g, " ")}</span>
      </button>
      {isOpen && item.children && (
        <div className="ml-4 mt-1 space-y-1">
          {item.children.map((child) => (
            <DocTreeItem
              key={child.path}
              item={child}
              currentPath={currentPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DocsSidebar({ structure }: DocsSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-background h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="font-semibold text-lg mb-4">Documentation</h2>
        <nav className="space-y-1">
          {structure.map((item) => (
            <DocTreeItem key={item.path} item={item} currentPath={pathname} />
          ))}
        </nav>
      </div>
    </aside>
  );
}
