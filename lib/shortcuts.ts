/**
 * Keyboard Shortcuts System
 *
 * Default Shortcuts (Navigation Mode):
 * - Space: Play/Pause
 * - Alt+Space: Play/Pause (also works in edit mode)
 * - Hold Alt: 2x playback speed
 * - Hold Ctrl: 0.5x playback speed
 * - Hold Alt+Ctrl: 4x playback speed
 * - ArrowRight/ArrowDown: Next word
 * - ArrowLeft/ArrowUp: Previous word (stops playback)
 * - Shift+ArrowRight: Next sentence
 * - Shift+ArrowLeft: Previous sentence
 * - Enter: Enter edit mode and select current word
 * - Any letter/number: Enter edit mode and type that character
 *
 * Edit Mode Shortcuts:
 * - Escape: Exit edit mode
 * - Alt+Space: Exit edit mode and toggle playback
 *
 * Custom Shortcuts:
 * - User can define custom key combinations that insert text at cursor
 */

export type CustomShortcut = {
  id: string;
  key: string; // e.g., "ctrl+1", "alt+a"
  text: string; // Text to insert
  description?: string;
};

const STORAGE_KEY = "transcription-custom-shortcuts";

export function getCustomShortcuts(): CustomShortcut[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to load custom shortcuts:", error);
    return [];
  }
}

export function saveCustomShortcuts(shortcuts: CustomShortcut[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
  } catch (error) {
    console.error("Failed to save custom shortcuts:", error);
  }
}

export function addCustomShortcut(
  shortcut: Omit<CustomShortcut, "id">,
): CustomShortcut {
  const shortcuts = getCustomShortcuts();
  const newShortcut: CustomShortcut = {
    ...shortcut,
    id: Date.now().toString(),
  };

  // Check if key already exists
  const existingIndex = shortcuts.findIndex((s) => s.key === shortcut.key);
  if (existingIndex !== -1) {
    // Replace existing shortcut
    shortcuts[existingIndex] = newShortcut;
  } else {
    shortcuts.push(newShortcut);
  }

  saveCustomShortcuts(shortcuts);
  return newShortcut;
}

export function deleteCustomShortcut(id: string): void {
  const shortcuts = getCustomShortcuts().filter((s) => s.id !== id);
  saveCustomShortcuts(shortcuts);
}

export function updateCustomShortcut(
  id: string,
  updates: Partial<CustomShortcut>,
): void {
  const shortcuts = getCustomShortcuts();
  const index = shortcuts.findIndex((s) => s.id === id);

  if (index !== -1) {
    shortcuts[index] = { ...shortcuts[index], ...updates };
    saveCustomShortcuts(shortcuts);
  }
}

export const defaultShortcuts = [
  {
    category: "Playback",
    shortcuts: [
      { keys: ["Alt + Space"], description: "Play/Pause" },
      { keys: ["Hold Ctrl"], description: "0.5x playback speed" },
      { keys: ["Hold Alt"], description: "2x playback speed" },
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
