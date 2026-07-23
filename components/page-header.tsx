import { cn } from "@/lib/utils/utils";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /**
   * Right-aligned header action(s) — typically a primary `<Button>`. Rendering
   * every page's main action through this single slot keeps them visually
   * consistent (same size, same placement) across the app.
   */
  action?: ReactNode;
  /** Optional "back" link shown above the title (e.g. back to the home). */
  backHref?: string;
  backLabel?: ReactNode;
  className?: string;
};

/**
 * The standard header for an app page: an optional back link, a title +
 * description on the left, and an optional action on the right. Use it (usually
 * via `PageLayout`) so headers and their action buttons stay uniform.
 */
export function PageHeader({
  title,
  description,
  action,
  backHref,
  backLabel,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        {action && (
          <div className="flex shrink-0 items-center gap-2">{action}</div>
        )}
      </div>
    </div>
  );
}
