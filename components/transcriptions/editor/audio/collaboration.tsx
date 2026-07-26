import { UserCursor } from "@/hooks/use-transcription-cursors";
import { EditorAPI } from "../text/api";
import { getUserColor } from "@/lib/utils/utils";
import { offsetToTime } from "./helpers";
import { useAudio } from "./audio-context";

export const CollaborationTicks = ({
  cursors,
  totalDuration,
  editorAPI,
}: {
  editorAPI: EditorAPI;
  totalDuration: number;
  cursors?: UserCursor[];
}) => {
  const { currentTime } = useAudio();

  return (
    <>
      <div
        className="absolute bottom-0 pointer-events-none z-10 transition-all duration-100 ease-out h-full w-0.5 bg-red-500"
        style={{
          left: `${100 * (currentTime / totalDuration)}%`,
          transform: "translateX(-50%)",
        }}
      />
      {(cursors || []).map((cursor) => {
        // While a peer is listening we get their audio position directly; otherwise
        // fall back to the audio time of their edit caret.
        const cursorTime =
          cursor.audioTime != null
            ? cursor.audioTime
            : offsetToTime(cursor.endOffset, editorAPI.getSegments());
        const duration = totalDuration || 1;
        const leftPercent = (cursorTime / duration) * 100;
        const color = getUserColor(cursor.userId);

        return (
          <div
            key={cursor.socketId}
            className="absolute bottom-0 pointer-events-none z-10 transition-all duration-100 ease-out"
            style={{
              left: `${leftPercent}%`,
              transform: "translateX(-50%)",
              bottom: "-3px",
            }}
          >
            {/* Cursor line */}
            <div
              className="w-0.5 h-2 animate-pulse"
              style={{ backgroundColor: color }}
            />
            {/* Small label */}
            <div
              className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium px-1 rounded-full shadow-lg"
              style={{
                backgroundColor: color,
                color: "white",
              }}
            >
              {cursor.userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toLocaleUpperCase()}
            </div>
          </div>
        );
      })}
    </>
  );
};
