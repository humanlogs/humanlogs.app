"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils/utils";

/**
 * Long-form markdown typography (blog, documentation) lives in `globals.css`
 * under `.markdown-body`. Tailwind's typography plugin is not installed, so
 * `prose-*` utilities do nothing here — the CSS block is the styling.
 */
export const markdownBodyClass = "markdown-body";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  return (
    <div className={cn(markdownBodyClass, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
