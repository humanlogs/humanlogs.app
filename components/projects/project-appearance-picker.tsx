"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/components/locale-provider";
import { cn } from "@/lib/utils/utils";
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  PROJECT_COLORS,
  PROJECT_COLOR_KEYS,
  PROJECT_ICON_KEYS,
  type ProjectIconType,
} from "@/lib/projects/appearance";
import { PROJECT_ICON_COMPONENTS } from "@/components/projects/project-badge";
import { ImageIcon, UploadIcon } from "lucide-react";

export type AppearanceValue = {
  iconType: ProjectIconType;
  icon: string | null;
  color: string;
};

const SUGGESTED_EMOJIS = [
  "🧪",
  "🔬",
  "🧠",
  "📚",
  "🎓",
  "📊",
  "📈",
  "🗂️",
  "📝",
  "💡",
  "🎯",
  "🎙️",
  "🎧",
  "🌍",
  "❤️",
  "⭐",
  "🚀",
  "🔥",
  "🌱",
  "🧩",
  "👥",
  "🏥",
  "⚖️",
  "🏛️",
  "💬",
  "📷",
  "🎵",
  "🗺️",
  "🔍",
  "🧬",
];

/**
 * Tabbed picker for a study's look: a curated Lucide icon, an emoji, or an
 * uploaded image — with a color for the first two. Fully controlled; the parent
 * owns both the appearance value and the pending image File (uploaded on save).
 */
export function ProjectAppearancePicker({
  value,
  onChange,
  projectId,
  hasExistingImage,
  imageVersion,
  pendingImageFile,
  onPendingImageChange,
}: {
  value: AppearanceValue;
  onChange: (v: AppearanceValue) => void;
  projectId?: string;
  hasExistingImage?: boolean;
  imageVersion?: string | number;
  pendingImageFile: File | null;
  onPendingImageChange: (file: File | null) => void;
}) {
  const t = useTranslations("dialog.project.appearance");
  const [error, setError] = React.useState<string | null>(null);

  // Object URL preview for a freshly-picked (not yet uploaded) image. Created
  // in a memo so it's stable per file, and revoked when the file changes or the
  // picker unmounts.
  const activePreview = React.useMemo(
    () => (pendingImageFile ? URL.createObjectURL(pendingImageFile) : null),
    [pendingImageFile],
  );
  React.useEffect(() => {
    return () => {
      if (activePreview) URL.revokeObjectURL(activePreview);
    };
  }, [activePreview]);

  const color = value.color || DEFAULT_PROJECT_COLOR;
  const setTab = (tab: string) => {
    const iconType = tab as ProjectIconType;
    // Only carry `value.icon` across when it belongs to the target type: an icon
    // *key* (e.g. "folder") is not an emoji, and reusing it would briefly render
    // the key as text in the emoji preview (and vice versa).
    if (iconType === "icon") {
      const keep = value.iconType === "icon" && value.icon;
      onChange({ iconType, color, icon: keep || DEFAULT_PROJECT_ICON });
    } else if (iconType === "emoji") {
      const keep = value.iconType === "emoji" && value.icon;
      onChange({ iconType, color, icon: keep || SUGGESTED_EMOJIS[0] });
    } else {
      onChange({ iconType: "image", color, icon: null });
    }
  };

  const handleFile = (file: File | null) => {
    setError(null);
    if (!file) {
      onPendingImageChange(null);
      return;
    }
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type,
      )
    ) {
      setError(t("errorType"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t("errorSize"));
      return;
    }
    onPendingImageChange(file);
    onChange({ iconType: "image", color, icon: null });
  };

  // Live preview badge.
  const imageSrc =
    activePreview ??
    (hasExistingImage && projectId
      ? `/api/projects/${projectId}/image${imageVersion ? `?v=${imageVersion}` : ""}`
      : null);

  const preview =
    value.iconType === "image" && imageSrc ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt=""
        className="h-14 w-14 rounded-xl object-cover"
      />
    ) : value.iconType === "emoji" ? (
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-xl text-3xl",
          PROJECT_COLORS[color],
        )}
      >
        <span className="leading-none">
          {value.icon || SUGGESTED_EMOJIS[0]}
        </span>
      </div>
    ) : value.iconType === "image" ? (
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
        <ImageIcon className="h-6 w-6" />
      </div>
    ) : (
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-xl text-white",
          PROJECT_COLORS[color],
        )}
      >
        {(() => {
          const Icon =
            PROJECT_ICON_COMPONENTS[
              (value.icon as keyof typeof PROJECT_ICON_COMPONENTS) ||
                DEFAULT_PROJECT_ICON
            ] ?? PROJECT_ICON_COMPONENTS[DEFAULT_PROJECT_ICON];
          return <Icon className="h-7 w-7" />;
        })()}
      </div>
    );

  const ColorRow = (
    <div className="flex flex-wrap gap-1.5">
      {PROJECT_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={key}
          onClick={() => onChange({ ...value, color: key })}
          className={cn(
            "h-6 w-6 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110",
            PROJECT_COLORS[key],
            color === key && "ring-2 ring-foreground",
          )}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {preview}
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      <Tabs
        defaultValue={value.iconType}
        value={value.iconType}
        onValueChange={setTab}
      >
        <TabsList className="w-full">
          <TabsTrigger value="icon" className="flex-1">
            {t("tabIcon")}
          </TabsTrigger>
          <TabsTrigger value="emoji" className="flex-1">
            {t("tabEmoji")}
          </TabsTrigger>
          <TabsTrigger value="image" className="flex-1">
            {t("tabImage")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="icon" className="space-y-3 pt-3">
          {ColorRow}
          <div className="grid grid-cols-8 gap-1.5">
            {PROJECT_ICON_KEYS.map((key) => {
              const Icon = PROJECT_ICON_COMPONENTS[key];
              const selected = value.iconType === "icon" && value.icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  onClick={() =>
                    onChange({ iconType: "icon", color, icon: key })
                  }
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    selected && "border-primary bg-accent text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="emoji" className="space-y-3 pt-3">
          {ColorRow}
          <div className="grid grid-cols-10 gap-1">
            {SUGGESTED_EMOJIS.map((emoji) => {
              const selected =
                value.iconType === "emoji" && value.icon === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() =>
                    onChange({ iconType: "emoji", color, icon: emoji })
                  }
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md text-lg transition-colors hover:bg-accent",
                    selected && "bg-accent ring-1 ring-primary",
                  )}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
          <Input
            value={value.iconType === "emoji" ? (value.icon ?? "") : ""}
            onChange={(e) => {
              const v = Array.from(e.target.value).slice(0, 4).join("");
              onChange({ iconType: "emoji", color, icon: v });
            }}
            placeholder={t("emojiPlaceholder")}
            className="text-center"
          />
        </TabsContent>

        <TabsContent value="image" className="space-y-3 pt-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground transition-colors hover:bg-accent/40">
            <UploadIcon className="h-5 w-5" />
            <span>
              {pendingImageFile
                ? pendingImageFile.name
                : hasExistingImage
                  ? t("replace")
                  : t("upload")}
            </span>
            <span className="text-xs">{t("imageHint")}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
