"use client";

import { useTranslations } from "@/components/locale-provider";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import type { DecryptedCodebook } from "@/lib/codebooks/codebook";
import type { GroupBy, SortBy } from "@/lib/documents/grouping";
import {
  ArrowDownUpIcon,
  CheckIcon,
  LayersIcon,
  Settings2Icon,
} from "lucide-react";

/**
 * The sidebar's "group by / sort by" control. One control for the whole list —
 * it sits on the phase header, since the phases are what the list hangs from.
 */
export function DocumentViewSettings({
  groupBy,
  sortBy,
  codebooks,
  allowGroupByStudy,
  onChange,
}: {
  groupBy: GroupBy;
  sortBy: SortBy;
  /** Codebooks offered as a grouping axis (roots covering every study). */
  codebooks: DecryptedCodebook[];
  /**
   * False once the list is scoped to one study: grouping by study would then
   * put the whole list under a header repeating the scope above it.
   */
  allowGroupByStudy: boolean;
  onChange: (patch: { groupBy?: GroupBy; sortBy?: SortBy }) => void;
}) {
  const t = useTranslations("sidebar");

  const groupOptions: Array<{ value: GroupBy; label: string }> = [
    { value: "updatedAt", label: t("view.updatedAt") },
    { value: "createdAt", label: t("view.createdAt") },
    ...(allowGroupByStudy
      ? [{ value: "study" as GroupBy, label: t("view.study") }]
      : []),
    ...codebooks.map((codebook) => ({
      value: `codebook:${codebook.id}` as GroupBy,
      label: codebook.name || t("view.untitledCodebook"),
    })),
  ];

  const sortOptions: Array<{ value: SortBy; label: string }> = [
    { value: "updatedAt", label: t("view.updatedAt") },
    { value: "createdAt", label: t("view.createdAt") },
    { value: "alphabetical", label: t("view.alphabetical") },
  ];

  return (
    <DropdownMenu
      align="end"
      trigger={
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-sidebar-accent"
          aria-label={t("view.settings")}
          title={t("view.settings")}
        >
          <Settings2Icon className="h-3 w-3" />
        </span>
      }
    >
      <DropdownMenuSub
        trigger={
          <>
            <LayersIcon className="mr-2 h-4 w-4" />
            {t("view.groupBy")}
          </>
        }
      >
        {groupOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange({ groupBy: option.value })}
            preventClose
            className="justify-between gap-4"
          >
            <span className="truncate">{option.label}</span>
            {groupBy === option.value && (
              <CheckIcon className="h-4 w-4 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSub>

      <DropdownMenuSub
        trigger={
          <>
            <ArrowDownUpIcon className="mr-2 h-4 w-4" />
            {t("view.sortBy")}
          </>
        }
      >
        {sortOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange({ sortBy: option.value })}
            preventClose
            className="justify-between gap-4"
          >
            <span className="truncate">{option.label}</span>
            {sortBy === option.value && (
              <CheckIcon className="h-4 w-4 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSub>
    </DropdownMenu>
  );
}
