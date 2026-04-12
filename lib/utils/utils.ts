import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const UNKNOWN_SPEAKER_COLORS = {
  hex: "#6b7280",
  tailwind: "bg-gray-500/10 border-gray-500/50 text-gray-500",
};

// Shared speaker color palette for consistent coloring across components
export const SPEAKER_COLORS = [
  {
    hex: "#3b82f6",
    tailwind: "bg-blue-500/10 border-blue-500/50 text-blue-500",
  },
  {
    hex: "#10b981",
    tailwind: "bg-green-500/10 border-green-500/50 text-green-500",
  },
  {
    hex: "#ec4899",
    tailwind: "bg-pink-500/10 border-pink-500/50 text-pink-500",
  },
  {
    hex: "#06b6d4",
    tailwind: "bg-cyan-500/10 border-cyan-500/50 text-cyan-500",
  },
  {
    hex: "#8b5cf6",
    tailwind: "bg-purple-500/10 border-purple-500/50 text-purple-500",
  },
  {
    hex: "#f59e0b",
    tailwind: "bg-amber-500/10 border-amber-500/50 text-amber-500",
  },
  {
    hex: "#f97316",
    tailwind: "bg-orange-500/10 border-orange-500/50 text-orange-500",
  },
  {
    hex: "#ef4444",
    tailwind: "bg-red-500/10 border-red-500/50 text-red-500",
  },
] as const;

export function getSpeakerColor(index: number): string {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length].hex;
}

export function getSpeakerColorClass(index: number): string {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length].tailwind;
}
