"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/components/locale-provider";
import type { DocHeading } from "@/lib/utils/docs-headings";
import { cn } from "@/lib/utils/utils";

/** Right-hand "on this page" rail, with the current section highlighted. */
export function DocsToc({ headings }: { headings: DocHeading[] }) {
  const t = useTranslations("docs");
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // Bias the viewport towards its top third: a heading counts as "current"
      // once it reaches the reading zone, not when it barely enters the screen.
      { rootMargin: "-80px 0px -66% 0px", threshold: 0 },
    );

    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <aside className="hidden xl:block w-56 flex-shrink-0">
      <div className="sticky top-24">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
          {t("toc.title")}
        </p>
        <ul className="space-y-1 border-l border-gray-200">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                className={cn(
                  "block border-l border-gray-200 -ml-px py-1 text-sm text-gray-600 transition-colors hover:text-black",
                  heading.level === 2 ? "pl-3" : "pl-6",
                  activeId === heading.id &&
                    "border-blue-500 text-black font-medium",
                )}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
