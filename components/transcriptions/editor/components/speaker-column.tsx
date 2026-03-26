"use client";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import _ from "lodash";
import { UserRoundPen, UserRoundPlus, Users } from "lucide-react";
import { getSpeakerColorClass } from "../../../../lib/utils";
import { TranscriptionSegment } from "../../../../hooks/use-api";
import { getSpeakerLabel, Speaker } from "../hooks/use-speaker-actions";
import { SpeakerPosition } from "../hooks/use-speaker-positions";
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
  positions: SpeakerPosition[];
  speakers: Speaker[];
  segments: TranscriptionSegment[];
  onRenameSpeaker: (speakerId: string, name: string) => void;
  onChangeSpeakerForTurn: (turnIndex: number, targetId: string | null) => void;
}

interface SpeakerBadgeProps {
  position: SpeakerPosition;
  speakers: Speaker[];
  segments: TranscriptionSegment[];
  onRenameSpeaker: (speakerId: string, name: string) => void;
  onChangeSpeakerForTurn: (turnIndex: number, targetId: string | null) => void;
}

function SpeakerBadge({
  position,
  speakers,
  segments,
  onRenameSpeaker,
  onChangeSpeakerForTurn,
}: SpeakerBadgeProps) {
  const { speakerId, index, top } = position;
  const { openRename } = useSpeakerRenameModal();

  const label = getSpeakerLabel(speakerId, speakers, segments);
  const speakerArrayIndex = speakers.findIndex((s) => s.id === speakerId);
  const colorClass = getSpeakerColorClass(
    speakerArrayIndex >= 0 ? speakerArrayIndex : index,
  );
  const otherSpeakers = speakers.filter((s) => s.id !== speakerId);

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
          Rename speaker
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuSub
          trigger={
            <span className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              Change speaker
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
            New speaker
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
