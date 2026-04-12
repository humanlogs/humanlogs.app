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
      { keys: ["Alt + Space"], description: "Play/Pause" },
      { keys: ["Hold Alt"], description: "0.5x playback speed" },
      { keys: ["Hold Ctrl"], description: "2x playback speed" },
      { keys: ["Hold Alt + Ctrl"], description: "4x playback speed" },
    ],
  },
  {
    category: "Navigation",
    shortcuts: [
      { keys: ["Arrow keys"], description: "Navigate word" },
      { keys: ["Shift + Arrow keys"], description: "Navigate sentence" },
      { keys: ["Enter"], description: "Enter edit mode" },
      { keys: ["Escape"], description: "Exit edit mode" },
    ],
  },
];
