"use client";

import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  flattenCodes,
  type Code,
  type CodeRef,
  type DecryptedCodebook,
} from "@/lib/codebooks/codebook";
import { PROJECT_COLORS } from "@/lib/projects/appearance";
import { cn } from "@/lib/utils/utils";
import { CheckIcon } from "lucide-react";

/**
 * The pieces shared by every place codes are applied: the checkable list inside
 * a menu, and the chips that show what a target already carries. Both are given
 * decrypted codebooks and opaque refs — they never fetch or save anything, so
 * the same rendering serves the editor's speaker menu and the study board.
 */

/** The code a ref points at, with its ancestor path, or null when it is gone. */
export function findCode(
  codebooks: Array<{ id: string; codes: Code[] }>,
  ref: CodeRef,
): { code: Code; path: string[] } | null {
  const codebook = codebooks.find((c) => c.id === ref.codebookId);
  if (!codebook) return null;
  const hit = flattenCodes(codebook.codes).find(
    ({ code }) => code.id === ref.codeId,
  );
  return hit ? { code: hit.code, path: hit.path } : null;
}

function colorClass(code: Code): string {
  return (code.color && PROJECT_COLORS[code.color]) || "bg-muted-foreground";
}

/**
 * One menu row per code, sub-codes indented under their parent. A header names
 * the codebook when several are listed: two codebooks may well hold codes with
 * the same label, and a flat list would not say which is which.
 */
export function CodeCheckItems({
  codebooks,
  isApplied,
  onToggle,
}: {
  codebooks: DecryptedCodebook[];
  isApplied: (codebookId: string, codeId: string) => boolean;
  onToggle: (codebookId: string, codeId: string) => void;
}) {
  return (
    <>
      {codebooks.map((codebook) => (
        <div key={codebook.id}>
          {codebooks.length > 1 && (
            <div className="truncate px-2 py-1 text-xs font-medium text-muted-foreground">
              {codebook.name}
            </div>
          )}
          {flattenCodes(codebook.codes).map(({ code, depth }) => (
            <DropdownMenuItem
              key={code.id}
              preventClose
              className="justify-between gap-4"
              onClick={() => onToggle(codebook.id, code.id)}
            >
              <span
                className="flex min-w-0 items-center gap-2"
                style={{ paddingLeft: depth * 12 }}
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    colorClass(code),
                  )}
                />
                <span className="truncate">{code.label}</span>
              </span>
              {isApplied(codebook.id, code.id) && (
                <CheckIcon className="h-4 w-4 shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
        </div>
      ))}
    </>
  );
}

/**
 * The codes a document or a speaker carries. Refs whose code no longer exists
 * are skipped rather than shown as unknown — deleting a code is what makes it
 * disappear from what it used to tag.
 */
export function CodeChips({
  refs,
  codebooks,
  className,
}: {
  refs: CodeRef[];
  codebooks: DecryptedCodebook[];
  className?: string;
}) {
  const resolved = refs
    .map((ref) => ({ ref, hit: findCode(codebooks, ref) }))
    .filter(
      (entry): entry is { ref: CodeRef; hit: { code: Code; path: string[] } } =>
        Boolean(entry.hit),
    );

  if (resolved.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {resolved.map(({ ref, hit }) => (
        <Badge
          key={`${ref.codebookId}:${ref.codeId}`}
          variant="outline"
          className="max-w-[12rem] gap-1.5 text-xs"
          title={hit.path.join(" › ")}
        >
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              colorClass(hit.code),
            )}
          />
          <span className="truncate">{hit.code.label}</span>
        </Badge>
      ))}
    </div>
  );
}
