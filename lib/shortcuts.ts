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

// API-based functions for managing shortcuts
export async function getCustomShortcuts(): Promise<CustomShortcut[]> {
  try {
    const response = await fetch("/api/user/shortcuts");
    if (!response.ok) {
      throw new Error("Failed to fetch shortcuts");
    }
    const data = await response.json();
    return data.shortcuts || [];
  } catch (error) {
    console.error("Failed to load custom shortcuts:", error);
    return [];
  }
}

export async function addCustomShortcut(
  shortcut: Omit<CustomShortcut, "id">,
): Promise<CustomShortcut> {
  const response = await fetch("/api/user/shortcuts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(shortcut),
  });

  if (!response.ok) {
    throw new Error("Failed to add shortcut");
  }

  const data = await response.json();
  return data.shortcut;
}

export async function deleteCustomShortcut(id: string): Promise<void> {
  const response = await fetch(`/api/user/shortcuts?id=${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete shortcut");
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
