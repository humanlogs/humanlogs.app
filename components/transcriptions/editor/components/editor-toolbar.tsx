"use client";

import { Bold, Italic, Underline } from "lucide-react";
import { Button } from "../../../ui/button";

interface EditorToolbarProps {
  applyFormat: (modifier: "b" | "i" | "u") => void;
}

export function EditorToolbar({ applyFormat }: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-6 shrink-0">
      <Button
        variant="outline"
        size="sm"
        onMouseDown={(e) => {
          e.preventDefault(); // keep focus in editor
          applyFormat("b");
        }}
        className="h-7 w-7 p-0 font-bold"
        title="Bold (⌘B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onMouseDown={(e) => {
          e.preventDefault();
          applyFormat("i");
        }}
        className="h-7 w-7 p-0 italic"
        title="Italic (⌘I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onMouseDown={(e) => {
          e.preventDefault();
          applyFormat("u");
        }}
        className="h-7 w-7 p-0 underline"
        title="Underline (⌘U)"
      >
        <Underline className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
