export type CustomShortcut = {
  id: string;
  key: string; // e.g., "ctrl+1", "alt+a"
  text: string; // Text to insert
  description?: string;
};

export const defaultShortcuts = [
  {
    category: "Playback",
    shortcuts: [
      { keys: ["Space", "Tab"], description: "Play/Pause" },
      { keys: ["Alt/Ctrl + Space"], description: "Play/Pause while editing" },
      { keys: ["Hold Alt"], description: "0.5x playback speed" },
      { keys: ["Hold Ctrl"], description: "2x playback speed" },
      { keys: ["Hold Alt + Ctrl"], description: "4x playback speed" },
    ],
  },
  {
    category: "Navigation",
    shortcuts: [
      { keys: ["Arrow keys"], description: "Navigate word" },
      // Sentence navigation moved from Shift to Ctrl when Shift took over
      // selection — the meaning it has in every other text surface.
      { keys: ["Ctrl + Arrow keys"], description: "Navigate sentence" },
      { keys: ["Enter"], description: "Enter edit mode" },
      { keys: ["Escape"], description: "Exit edit mode / clear selection" },
    ],
  },
  {
    category: "Selection",
    shortcuts: [
      { keys: ["Shift + ← / →"], description: "Select one more word" },
      {
        keys: ["Shift + ↑ / ↓"],
        description: "Select up to the next punctuation",
      },
      {
        keys: ["Ctrl + Shift + arrows"],
        description: "Select one more sentence",
      },
      { keys: ["A", "B", "…"], description: "Apply the code shown (coding)" },
      {
        keys: ["Escape"],
        description: "Leave a group of sub-codes (coding)",
      },
      { keys: ["Ctrl/⌘ + Z"], description: "Undo the last code (coding)" },
    ],
  },
];
