"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import {
  AlertCircleIcon,
  AudioLinesIcon,
  FileTextIcon,
  LoaderIcon,
  Share2Icon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";

type DocumentListItem = {
  id: string;
  title: string;
  updatedAt: string;
  state: "PENDING" | "COMPLETED" | "ERROR";
  mediaType?: "audio" | "text";
  speakerCount?: number;
  speakerNames?: (string | null)[];
  shared?: unknown[];
};

/**
 * The list of documents (transcriptions) shown on the study page and, for
 * documents that aren't attached to any study, on the home page. Rows are
 * intentionally dense: a single line with the title on the left and a compact
 * metadata cluster (kind, speakers, sharing, date) on the right. Each row links
 * to the transcription editor.
 */
export function DocumentList({ documents }: { documents: DocumentListItem[] }) {
  const t = useTranslations("study");
  const { locale } = useLocale();

  return (
    <ul className="divide-y overflow-hidden rounded-xl border">
      {documents.map((doc) => {
        const names = (doc.speakerNames ?? []).filter((n): n is string => !!n);
        const count = doc.speakerCount ?? 0;
        const isText = doc.mediaType === "text";
        const isShared = (doc.shared?.length ?? 0) > 0;

        return (
          <li key={doc.id}>
            <Link
              href={`/app/transcription/${doc.id}`}
              className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-accent/40"
            >
              <DocumentStateIcon state={doc.state} isText={isText} />
              <span className="min-w-0 flex-1 truncate font-medium">
                {doc.title || t("documents.untitled")}
              </span>

              <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                {count > 0 && (
                  <span
                    className="hidden items-center gap-1 sm:flex"
                    title={names.length > 0 ? names.join(", ") : undefined}
                  >
                    <UsersIcon className="h-3.5 w-3.5" />
                    {count}
                  </span>
                )}
                {isShared && (
                  <Share2Icon
                    className="hidden h-3.5 w-3.5 sm:block"
                    aria-label={t("documents.shared")}
                  />
                )}
                <time
                  dateTime={doc.updatedAt}
                  className="tabular-nums"
                  title={t("documents.updatedAt", {
                    date: new Date(doc.updatedAt).toLocaleDateString(locale),
                  })}
                >
                  {new Date(doc.updatedAt).toLocaleDateString(locale, {
                    day: "numeric",
                    month: "short",
                  })}
                </time>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DocumentStateIcon({
  state,
  isText,
}: {
  state: "PENDING" | "COMPLETED" | "ERROR";
  isText: boolean;
}) {
  if (state === "PENDING")
    return (
      <LoaderIcon
        className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
        style={{ animationDuration: "5s" }}
      />
    );
  if (state === "ERROR")
    return <AlertCircleIcon className="h-4 w-4 shrink-0 text-red-500" />;
  return isText ? (
    <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
  ) : (
    <AudioLinesIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
  );
}
