"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { Children, isValidElement, type ReactNode } from "react";
import { markdownProseClasses } from "@/components/markdown-viewer";
import { slugifyHeading } from "@/lib/utils/docs-utils";
import { cn } from "@/lib/utils/utils";

/**
 * The blog renders markdown as-is; docs need two extra things the plain
 * `MarkdownViewer` deliberately does not do: anchored headings (so the table of
 * contents can link into the page) and tables that scroll instead of blowing
 * out the layout on mobile.
 */

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return "";
}

function Heading({
  level,
  children,
}: {
  level: 2 | 3;
  children?: ReactNode;
}) {
  const id = slugifyHeading(textOf(children));
  const Tag = level === 2 ? "h2" : "h3";

  return (
    <Tag id={id} className="group">
      {children}
      <a
        href={`#${id}`}
        aria-hidden
        tabIndex={-1}
        className="ml-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 no-underline"
      >
        #
      </a>
    </Tag>
  );
}

export function DocsMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn(markdownProseClasses, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => <Heading level={2}>{children}</Heading>,
          h3: ({ children }) => <Heading level={3}>{children}</Heading>,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => {
            const target = href ?? "";
            if (target.startsWith("/")) {
              return <Link href={target}>{children}</Link>;
            }
            if (target.startsWith("#")) {
              return <a href={target}>{children}</a>;
            }
            return (
              <a href={target} target="_blank" rel="noopener noreferrer">
                {Children.toArray(children)}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
