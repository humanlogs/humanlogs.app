"use client";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import _ from "lodash";
import { UserCog, UserRoundPen, UserRoundPlus, Users } from "lucide-react";
import { getSpeakerColorClass } from "../../../../lib/utils";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { getSpeakerLabel, Speaker } from "../hooks/use-speaker-actions";
import { SpeakerPosition } from "../hooks/use-speaker-positions";
import { useSpeakerRenameModal } from "./speaker-rename-dialog";
import {
  useSpeakerOptionsModal,
  SpeakerOptionsData,
} from "../../dialogs/speaker-options-dialog";
import { useTranslations } from "@/components/locale-provider";

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
  positions: SpeakerPosition[];
  speakers: Speaker[];
  segments: TranscriptionSegment[];
  onRenameSpeaker: (speakerId: string, name: string) => void;
  onChangeSpeakerForTurn: (turnIndex: number, targetId: string | null) => void;
  onApplySpeakerOptions?: (options: SpeakerOptionsData) => void;
}

interface SpeakerBadgeProps {
  position: SpeakerPosition;
  speakers: Speaker[];
  segments: TranscriptionSegment[];
  onRenameSpeaker: (speakerId: string, name: string) => void;
  onChangeSpeakerForTurn: (turnIndex: number, targetId: string | null) => void;
  onApplySpeakerOptions?: (options: SpeakerOptionsData) => void;
}

function SpeakerBadge({
  position,
  speakers,
  segments,
  onRenameSpeaker,
  onChangeSpeakerForTurn,
  onApplySpeakerOptions,
}: SpeakerBadgeProps) {
  const t = useTranslations("editor");
  const { speakerId, index, top } = position;
  const { openRename } = useSpeakerRenameModal();
  const { openSpeakerOptions } = useSpeakerOptionsModal();

  const label = getSpeakerLabel(speakerId, speakers, segments);
  const speakerArrayIndex = speakers.findIndex((s) => s.id === speakerId);
  const colorClass = getSpeakerColorClass(
    speakerArrayIndex >= 0 ? speakerArrayIndex : index,
  );
  const otherSpeakers = speakers.filter((s) => s.id !== speakerId);

  const handleOpenSpeakerOptions = () => {
    const transcription = {
      speakers: speakers.map((s) => ({ id: s.id, name: s.name })),
      words: segments,
    };
    openSpeakerOptions(
      transcription,
      speakers,
      segments,
      onApplySpeakerOptions || (() => {}),
      speakerId, // Pre-select the clicked speaker
    );
  };

  return (
    <div
      className="absolute left-0 -translate-y-1/2 whitespace-nowrap"
      style={{ top }}
    >
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
        <DropdownMenuItem
          onClick={() =>
            openRename(speakerId, label, (name) =>
              onRenameSpeaker(speakerId, name),
            )
          }
        >
          <UserRoundPen className="mr-2 h-3.5 w-3.5" />
          {t("speaker.renameSpeaker")}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleOpenSpeakerOptions}>
          <UserCog className="mr-2 h-3.5 w-3.5" />
          {t("speaker.speakerOptions")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

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
              onClick={() => onChangeSpeakerForTurn(index, s.id)}
            >
              {getSpeakerLabel(s.id, speakers, segments)}
            </DropdownMenuItem>
          ))}
          {otherSpeakers.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={() => onChangeSpeakerForTurn(index, null)}>
            <UserRoundPlus className="mr-2 h-3.5 w-3.5" />
            {t("speaker.newSpeaker")}
          </DropdownMenuItem>
        </DropdownMenuSub>
      </DropdownMenu>
    </div>
  );
}

export function SpeakerColumn({
  positions,
  speakers,
  segments,
  onRenameSpeaker,
  onChangeSpeakerForTurn,
  onApplySpeakerOptions,
}: SpeakerColumnProps) {
  if (positions.length === 0) return <div className="w-24 shrink-0" />;

  return (
    <div className="relative w-max shrink-0 whitespace-nowrap">
      {positions.map((pos) => (
        <SpeakerBadge
          key={`${pos.speakerId}-${pos.index}`}
          position={pos}
          speakers={speakers}
          segments={segments}
          onRenameSpeaker={onRenameSpeaker}
          onChangeSpeakerForTurn={onChangeSpeakerForTurn}
          onApplySpeakerOptions={onApplySpeakerOptions}
        />
      ))}

      {/* Invisible badges — reserve column width for the widest speaker name so the layout never shifts on rename/add. */}
      <div className="opacity-0 pointer-events-none flex flex-col gap-1">
        {_.uniqBy(positions, "speakerId").map((s) => {
          const idx = speakers.findIndex((sp) => sp.id === s.speakerId);
          return (
            <SpeakerBadgeChip
              key={s.speakerId}
              label={getSpeakerLabel(s.speakerId, speakers, segments)}
              colorClass={getSpeakerColorClass(idx >= 0 ? idx : s.index)}
            />
          );
        })}
      </div>
    </div>
  );
}
