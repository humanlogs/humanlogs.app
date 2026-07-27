"use client";

import { cn } from "@/lib/utils/utils";
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  PROJECT_COLORS,
  type ProjectAppearance,
  type ProjectIconKey,
} from "@/lib/projects/appearance";
import {
  BookIcon,
  BrainIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  CameraIcon,
  ClipboardListIcon,
  FileTextIcon,
  FlaskConicalIcon,
  FolderIcon,
  GlobeIcon,
  GraduationCapIcon,
  HeadphonesIcon,
  HeartIcon,
  LeafIcon,
  LightbulbIcon,
  type LucideIcon,
  MapPinIcon,
  MessageCircleIcon,
  MicIcon,
  MicroscopeIcon,
  MusicIcon,
  StarIcon,
  TargetIcon,
  UsersIcon,
} from "lucide-react";

// Keep in sync with PROJECT_ICON_KEYS in lib/projects/appearance.ts.
export const PROJECT_ICON_COMPONENTS: Record<ProjectIconKey, LucideIcon> = {
  folder: FolderIcon,
  book: BookIcon,
  "graduation-cap": GraduationCapIcon,
  flask: FlaskConicalIcon,
  microscope: MicroscopeIcon,
  brain: BrainIcon,
  users: UsersIcon,
  "message-circle": MessageCircleIcon,
  mic: MicIcon,
  headphones: HeadphonesIcon,
  "file-text": FileTextIcon,
  "clipboard-list": ClipboardListIcon,
  briefcase: BriefcaseIcon,
  building: BuildingIcon,
  globe: GlobeIcon,
  "map-pin": MapPinIcon,
  heart: HeartIcon,
  star: StarIcon,
  lightbulb: LightbulbIcon,
  target: TargetIcon,
  calendar: CalendarIcon,
  camera: CameraIcon,
  music: MusicIcon,
  leaf: LeafIcon,
};

type Size = "xs" | "sm" | "md" | "lg";

const SIZES: Record<Size, { box: string; icon: string; emoji: string }> = {
  xs: {
    box: "h-4 w-4 rounded-[4px]",
    icon: "h-2.5 w-2.5",
    emoji: "text-[10px]",
  },
  sm: { box: "h-6 w-6 rounded-md", icon: "h-3.5 w-3.5", emoji: "text-sm" },
  md: { box: "h-10 w-10 rounded-lg", icon: "h-5 w-5", emoji: "text-xl" },
  lg: { box: "h-12 w-12 rounded-xl", icon: "h-6 w-6", emoji: "text-2xl" },
};

/**
 * The visual identity of a study: an uploaded image, or a Lucide icon / emoji
 * on a colored badge. Falls back to a neutral default when nothing is set, so
 * it is always safe to render.
 */
export function ProjectBadge({
  appearance,
  projectId,
  name,
  size = "md",
  imageVersion,
  className,
}: {
  appearance?: ProjectAppearance | null;
  projectId: string;
  name?: string;
  size?: Size;
  /** Cache-busting token (e.g. the project's updatedAt) for the image URL. */
  imageVersion?: string | number;
  className?: string;
}) {
  const s = SIZES[size];

  if (appearance?.iconType === "image" && appearance.hasImage) {
    const v = imageVersion ? `?v=${encodeURIComponent(String(imageVersion))}` : "";
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/projects/${projectId}/image${v}`}
        alt={name ?? ""}
        className={cn("shrink-0 object-cover", s.box, className)}
      />
    );
  }

  const colorClass =
    PROJECT_COLORS[appearance?.color ?? ""] ??
    PROJECT_COLORS[DEFAULT_PROJECT_COLOR];

  const content =
    appearance?.iconType === "emoji" && appearance.icon ? (
      <span className={cn("leading-none", s.emoji)}>{appearance.icon}</span>
    ) : (
      (() => {
        const Icon =
          (appearance?.iconType === "icon" &&
            appearance.icon &&
            PROJECT_ICON_COMPONENTS[appearance.icon as ProjectIconKey]) ||
          PROJECT_ICON_COMPONENTS[DEFAULT_PROJECT_ICON];
        return <Icon className={s.icon} />;
      })()
    );

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center text-white",
        s.box,
        colorClass,
        className,
      )}
    >
      {content}
    </div>
  );
}
