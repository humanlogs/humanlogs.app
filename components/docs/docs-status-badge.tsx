"use client";

import { useTranslations } from "@/components/locale-provider";
import type { DocStatus } from "@/lib/utils/docs-utils";
import { cn } from "@/lib/utils/utils";

const STYLES: Record<DocStatus, string> = {
  live: "",
  beta: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  soon: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
};

/**
 * `live` pages carry no badge — the badge exists to warn, not to decorate, so
 * only `beta` and `soon` render anything.
 */
export function DocsStatusBadge({
  status,
  className,
}: {
  status: DocStatus;
  className?: string;
}) {
  const t = useTranslations("docs");

  if (status === "live") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        STYLES[status],
        className,
      )}
    >
      {t(`status.${status}`)}
    </span>
  );
}
