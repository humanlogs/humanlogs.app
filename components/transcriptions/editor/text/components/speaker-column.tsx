"use client";

import { useTranslations } from "@/components/locale-provider";
import { useSpeakerOptionsModal } from "@/components/transcriptions/dialogs/speaker-options-dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import _ from "lodash";
import { UserCog, UserRoundPen, UserRoundPlus, Users } from "lucide-react";
import {
  getSpeakerColorClass,
  UNKNOWN_SPEAKER_COLORS,
} from "../../../../../lib/utils";
import { EditorAPI } from "../api";
import { getSpeakerLabel } from "../hooks/use-speaker-actions";
import {
  SpeakerPosition,
  useSpeakerPositions,
} from "../hooks/use-speaker-positions";
import { useSpeakerRenameModal } from "./speaker-rename-dialog";

/** Shared badge chip — used for interactive badges and the invisible decoy row. */
export function SpeakerBadgeChip({
  label,
  colorClass,
  className,
}: {
  label: string;
  colorClass: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={`h-5 text-xs ${colorClass} ${className ?? ""}`}
    >
      {label}
    </Badge>
  );
}

interface SpeakerColumnProps {
  editorAPI: EditorAPI;
  readOnly?: boolean;
}

interface SpeakerBadgeProps {
  position: SpeakerPosition;
  editorAPI: EditorAPI;
  readOnly?: boolean;
}

function SpeakerBadge({
  position,
  editorAPI,
  readOnly = false,
}: SpeakerBadgeProps) {
  const t = useTranslations("editor");
  const { speakerId, index, top } = position;
  const { openRename } = useSpeakerRenameModal();
  const { openSpeakerOptions } = useSpeakerOptionsModal();

  const speakers = editorAPI.getSpeakers();

  const speakerKnown = speakerId
    ? speakers.some((s) => s.id === speakerId)
    : false;

  const label = getSpeakerLabel(speakerId, speakers);
  const speakerArrayIndex = speakers.findIndex((s) => s.id === speakerId);
  const colorClass = speakerKnown
    ? getSpeakerColorClass(speakerArrayIndex >= 0 ? speakerArrayIndex : index)
    : (UNKNOWN_SPEAKER_COLORS as any);
  const otherSpeakers = speakers.filter((s) => s.id !== speakerId);

  const handleOpenSpeakerOptions = () => {
    const transcription = {
      speakers: speakers.map((s) => ({ id: s.id, name: s.name })),
      words: editorAPI.getSegments(),
    };
    openSpeakerOptions(
      transcription,
      speakers,
      editorAPI.getSegments(),
      (options) => {
        // Apply the speaker options directly to the TipTap editor
        editorAPI.applySpeakerOptions(options);
      },
      speakerId, // Pre-select the clicked speaker
    );
  };

  const handleChangeSpeaker = (newSpeakerId: string) => {
    editorAPI.changeParagraphSpeaker(index, newSpeakerId);
  };

  const handleCreateAndAssignSpeaker = () => {
    const newSpeakerId = editorAPI.createSpeaker();
    editorAPI.changeParagraphSpeaker(index, newSpeakerId);

    // Open rename dialog for the newly created speaker
    const newSpeaker = editorAPI
      .getSpeakers()
      .find((s) => s.id === newSpeakerId);
    if (newSpeaker) {
      openRename(newSpeakerId, newSpeaker.name || "", (name) =>
        editorAPI.renameSpeaker(newSpeakerId, name),
      );
    }
  };

  const handleRenameSpeaker = () => {
    openRename(speakerId, label, (name) => {
      editorAPI.renameSpeaker(speakerId, name);
    });
  };

  return (
    <div className="absolute left-0 whitespace-nowrap" style={{ top: top }}>
      {readOnly ? (
        <SpeakerBadgeChip
          label={label}
          colorClass={colorClass}
          className="select-none"
        />
      ) : (
        <DropdownMenu
          align="start"
          trigger={
            <SpeakerBadgeChip
              label={label}
              colorClass={colorClass}
              className="cursor-pointer select-none"
            />
          }
        >
          {speakerKnown && (
            <>
              <DropdownMenuItem onClick={handleRenameSpeaker}>
                <UserRoundPen className="mr-2 h-3.5 w-3.5" />
                {t("speaker.renameSpeaker")}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleOpenSpeakerOptions}>
                <UserCog className="mr-2 h-3.5 w-3.5" />
                {t("speaker.speakerOptions")}
              </DropdownMenuItem>

              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuSub
            trigger={
              <span className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                {t("speaker.changeSpeaker")}
              </span>
            }
          >
            {otherSpeakers.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={() => handleChangeSpeaker(s.id)}
              >
                {getSpeakerLabel(s.id, speakers)}
              </DropdownMenuItem>
            ))}
            {otherSpeakers.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={handleCreateAndAssignSpeaker}>
              <UserRoundPlus className="mr-2 h-3.5 w-3.5" />
              {t("speaker.newSpeaker")}
            </DropdownMenuItem>
          </DropdownMenuSub>
        </DropdownMenu>
      )}
    </div>
  );
}

export function SpeakerColumn({
  editorAPI,
  readOnly = false,
}: SpeakerColumnProps) {
  const { positions } = useSpeakerPositions(editorAPI);
  if (positions.length === 0) return <div className="w-24 shrink-0" />;

  return (
    <div className="relative w-max shrink-0 whitespace-nowrap overflow-hidden">
      {positions.map((pos) => (
        <SpeakerBadge
          key={`${pos.speakerId}-${pos.index}`}
          position={pos}
          editorAPI={editorAPI}
          readOnly={readOnly}
        />
      ))}

      {/* Invisible badges — reserve column width for the widest speaker name so the layout never shifts on rename/add. */}
      <div className="opacity-0 pointer-events-none flex flex-col gap-1">
        {_.uniqBy(positions, "speakerId").map((s) => {
          const idx = editorAPI
            .getSpeakers()
            .findIndex((sp) => sp.id === s.speakerId);
          return (
            <SpeakerBadgeChip
              key={s.speakerId}
              label={getSpeakerLabel(s.speakerId, editorAPI.getSpeakers())}
              colorClass={getSpeakerColorClass(idx >= 0 ? idx : s.index)}
            />
          );
        })}
      </div>
    </div>
  );
}
