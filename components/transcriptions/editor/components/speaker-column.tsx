"use client";

import { useTranslations } from "@/components/locale-provider";
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
import {
  SpeakerOptionsData,
  useSpeakerOptionsModal,
} from "../../dialogs/speaker-options-dialog";
import { EditorAPI } from "../hooks/editor-api-tiptap";
import { getSpeakerLabel, Speaker } from "../hooks/use-speaker-actions";
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
  speakers: Speaker[];
  editorAPIRef: { current: EditorAPI };
  onRenameSpeaker: (speakerId: string, name: string) => void;
  onChangeSpeakerForTurn: (turnIndex: number, targetId: string | null) => void;
  onApplySpeakerOptions?: (options: SpeakerOptionsData) => void;
  readOnly?: boolean;
  recalculateSpeakerRef: React.MutableRefObject<() => void>;
}

interface SpeakerBadgeProps {
  position: SpeakerPosition;
  speakers: Speaker[];
  editorAPIRef: { current: EditorAPI };
  onRenameSpeaker: (speakerId: string, name: string) => void;
  onChangeSpeakerForTurn: (turnIndex: number, targetId: string | null) => void;
  onApplySpeakerOptions?: (options: SpeakerOptionsData) => void;
  readOnly?: boolean;
}

function SpeakerBadge({
  position,
  speakers,
  editorAPIRef,
  onRenameSpeaker,
  onChangeSpeakerForTurn,
  onApplySpeakerOptions,
  readOnly = false,
}: SpeakerBadgeProps) {
  const t = useTranslations("editor");
  const { speakerId, index, top } = position;
  const { openRename } = useSpeakerRenameModal();
  const { openSpeakerOptions } = useSpeakerOptionsModal();

  const label = getSpeakerLabel(speakerId, speakers);
  const speakerArrayIndex = speakers.findIndex((s) => s.id === speakerId);
  const colorClass = getSpeakerColorClass(
    speakerArrayIndex >= 0 ? speakerArrayIndex : index,
  );
  const otherSpeakers = speakers.filter((s) => s.id !== speakerId);

  const handleOpenSpeakerOptions = () => {
    const transcription = {
      speakers: speakers.map((s) => ({ id: s.id, name: s.name })),
      words: editorAPIRef.current.getSegments(),
    };
    openSpeakerOptions(
      transcription,
      speakers,
      editorAPIRef.current.getSegments(),
      onApplySpeakerOptions || (() => {}),
      speakerId, // Pre-select the clicked speaker
    );
  };

  return (
    <div className="absolute left-0 whitespace-nowrap" style={{ top: top - 4 }}>
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
                {getSpeakerLabel(s.id, speakers)}
              </DropdownMenuItem>
            ))}
            {otherSpeakers.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => onChangeSpeakerForTurn(index, null)}
            >
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
  speakers,
  editorAPIRef,
  onRenameSpeaker,
  onChangeSpeakerForTurn,
  onApplySpeakerOptions,
  recalculateSpeakerRef,
  readOnly = false,
}: SpeakerColumnProps) {
  const { positions, recalculate } = useSpeakerPositions(
    editorAPIRef as { current: EditorAPI },
  );
  recalculateSpeakerRef.current = recalculate;

  if (positions.length === 0) return <div className="w-24 shrink-0" />;

  return (
    <div className="relative w-max shrink-0 whitespace-nowrap overflow-hidden">
      {positions.map((pos) => (
        <SpeakerBadge
          key={`${pos.speakerId}-${pos.index}`}
          position={pos}
          speakers={speakers}
          editorAPIRef={editorAPIRef}
          onRenameSpeaker={onRenameSpeaker}
          onChangeSpeakerForTurn={onChangeSpeakerForTurn}
          onApplySpeakerOptions={onApplySpeakerOptions}
          readOnly={readOnly}
        />
      ))}

      {/* Invisible badges — reserve column width for the widest speaker name so the layout never shifts on rename/add. */}
      <div className="opacity-0 pointer-events-none flex flex-col gap-1">
        {_.uniqBy(positions, "speakerId").map((s) => {
          const idx = speakers.findIndex((sp) => sp.id === s.speakerId);
          return (
            <SpeakerBadgeChip
              key={s.speakerId}
              label={getSpeakerLabel(s.speakerId, speakers)}
              colorClass={getSpeakerColorClass(idx >= 0 ? idx : s.index)}
            />
          );
        })}
      </div>
    </div>
  );
}
