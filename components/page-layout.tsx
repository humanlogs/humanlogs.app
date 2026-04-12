import { cn } from "@/lib/utils/utils";
import { ReactNode } from "react";

type PageLayoutProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  maxWidth?: "max-w-4xl" | "max-w-6xl";
  className?: string;
};

export function PageLayout({
  title,
  description,
  children,
  maxWidth = "max-w-4xl",
  className,
}: PageLayoutProps) {
  return (
    <div
      className={cn(
        "container mx-auto p-4 py-12 space-y-6",
        maxWidth,
        className,
      )}
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-2">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
