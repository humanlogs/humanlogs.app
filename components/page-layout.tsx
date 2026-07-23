import { cn } from "@/lib/utils/utils";
import { ReactNode } from "react";
import { PageHeader } from "./page-header";

type PageLayoutProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned header action, typically a primary `<Button>`. */
  action?: ReactNode;
  /** Optional "back" link shown above the title. */
  backHref?: string;
  backLabel?: ReactNode;
  children: ReactNode;
  maxWidth?: "max-w-4xl" | "max-w-6xl";
  className?: string;
};

export function PageLayout({
  title,
  description,
  action,
  backHref,
  backLabel,
  children,
  maxWidth = "max-w-4xl",
  className,
}: PageLayoutProps) {
  return (
    <div
      className={cn(
        "container mx-auto p-4 py-12 space-y-6 animate-fade-in",
        maxWidth,
        className,
      )}
    >
      <PageHeader
        title={title}
        description={description}
        action={action}
        backHref={backHref}
        backLabel={backLabel}
      />
      {children}
    </div>
  );
}
