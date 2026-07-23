/**
 * Study (project) visual customization: a colored badge showing either a
 * curated Lucide icon, an emoji, or an uploaded image. This module is the
 * single source of truth for the palette and icon keys, and is intentionally
 * free of React/Lucide imports so API routes can import it for validation.
 */

export type ProjectIconType = "icon" | "emoji" | "image";

/**
 * Palette keys → the Tailwind background class for the badge. The classes must
 * be written out in full (not built by interpolation) so Tailwind keeps them.
 * White foreground is applied by the badge component and reads well on every
 * 500-weight background in both themes.
 */
export const PROJECT_COLORS: Record<string, string> = {
  slate: "bg-slate-500",
  gray: "bg-gray-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  teal: "bg-teal-500",
  sky: "bg-sky-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
};

export const PROJECT_COLOR_KEYS = Object.keys(PROJECT_COLORS);

export const DEFAULT_PROJECT_COLOR = "blue";

/**
 * Curated set of Lucide icon keys offered in the picker. The actual icon
 * components are mapped in `project-badge.tsx` (client-only); keep the two in
 * sync when adding a key here.
 */
export const PROJECT_ICON_KEYS = [
  "folder",
  "book",
  "graduation-cap",
  "flask",
  "microscope",
  "brain",
  "users",
  "message-circle",
  "mic",
  "headphones",
  "file-text",
  "clipboard-list",
  "briefcase",
  "building",
  "globe",
  "map-pin",
  "heart",
  "star",
  "lightbulb",
  "target",
  "calendar",
  "camera",
  "music",
  "leaf",
] as const;

export type ProjectIconKey = (typeof PROJECT_ICON_KEYS)[number];

export const DEFAULT_PROJECT_ICON: ProjectIconKey = "folder";

export function isValidColor(value: unknown): value is string {
  return typeof value === "string" && value in PROJECT_COLORS;
}

export function isValidIconKey(value: unknown): value is ProjectIconKey {
  return (
    typeof value === "string" &&
    (PROJECT_ICON_KEYS as readonly string[]).includes(value)
  );
}

/**
 * A single emoji is a short string; we don't try to fully validate grapheme
 * clusters, just guard against oversized/empty input.
 */
export function isValidEmoji(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    // A composed emoji (with ZWJ/skin-tone modifiers) can be several code
    // points; cap generously by string length.
    value.length <= 16
  );
}

export type ProjectAppearance = {
  iconType: ProjectIconType | null;
  icon: string | null;
  color: string | null;
  /** True when an uploaded image exists (the URL is served by an API route). */
  hasImage?: boolean;
};

/**
 * Normalizes appearance fields coming from a request body into a value safe to
 * persist, or `null` for a field that should be left unchanged. `image` uploads
 * are handled by their own endpoint, not here. Returns `{ error }` when the
 * combination is invalid.
 */
export function parseAppearanceUpdate(body: Record<string, unknown>):
  | {
      data: {
        iconType?: ProjectIconType;
        icon?: string;
        color?: string;
      };
    }
  | { error: string } {
  const data: { iconType?: ProjectIconType; icon?: string; color?: string } =
    {};

  if (body.iconType !== undefined) {
    if (body.iconType === "icon" || body.iconType === "emoji") {
      data.iconType = body.iconType;
    } else {
      // "image" is set by the image upload endpoint, not here.
      return { error: "Invalid iconType" };
    }
  }

  if (body.color !== undefined) {
    if (!isValidColor(body.color)) return { error: "Invalid color" };
    data.color = body.color;
  }

  if (body.icon !== undefined) {
    const type = data.iconType;
    if (type === "icon") {
      if (!isValidIconKey(body.icon)) return { error: "Invalid icon" };
      data.icon = body.icon;
    } else if (type === "emoji") {
      if (!isValidEmoji(body.icon)) return { error: "Invalid emoji" };
      data.icon = (body.icon as string).trim();
    } else {
      // icon provided without a matching iconType in the same request.
      return { error: "icon requires a matching iconType" };
    }
  }

  return { data };
}
