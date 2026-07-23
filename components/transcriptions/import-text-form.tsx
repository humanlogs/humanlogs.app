"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { ProjectSelector } from "@/components/project-selector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { IMPORT_EXTENSIONS, IMPORT_FORMAT_OPTIONS } from "@/lib/import/types";
import type { ImportFormat } from "@/lib/import/types";
import { getLanguageOptions } from "@/lib/utils/languages";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileTextIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

const ACCEPT = IMPORT_EXTENSIONS.join(",");

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Import an already-produced transcript (JSON, CSV, TXT, DOCX, SRT, VTT, NVivo,
 * MAXQDA) as a text-typed transcription. No audio, no STT, no credits.
 */
export function ImportTextForm({
  defaultProjectId,
  defaultLanguage,
}: {
  defaultProjectId?: string;
  defaultLanguage: string;
}) {
  const t = useTranslations("newTranscription");
  const { locale } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [file, setFile] = React.useState<File | null>(null);
  const [format, setFormat] = React.useState<ImportFormat | "auto">("auto");
  const [projectId, setProjectId] = React.useState<string | undefined>(
    defaultProjectId,
  );
  const [language, setLanguage] = React.useState<string>(defaultLanguage);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => {
    setError(null);
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", file.name);
      formData.append("format", format);
      formData.append("language", language);
      if (projectId) formData.append("projectId", projectId);

      const response = await fetch("/api/transcriptions/import", {
        method: "POST",
        body: formData,
      });

      if (response.status === 401) {
        router.push("/app/login");
        return;
      }

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = body?.error || "Failed to import the document";
        setError(message);
        toast.error(message);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
      router.push(`/app/transcription/${body.transcriptionId}`);
    } catch {
      const message = "Something went wrong while importing the document";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 flex items-center justify-center space-x-4 text-left transition-colors cursor-pointer ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="border rounded-md w-12 h-12 flex items-center justify-center shrink-0">
          <UploadIcon className="w-6 h-6 text-black dark:text-white" />
        </div>
        <div>
          <p className="text-lg font-medium">Drop a transcript file here</p>
          <p className="text-sm text-muted-foreground">
            JSON, CSV, TXT, DOCX, SRT, VTT, NVivo or MAXQDA
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {/* Selected file */}
      {file && (
        <div className="flex items-center gap-4 p-4 border rounded-lg">
          <div className="rounded-md w-12 h-12 flex items-center justify-center bg-muted">
            <FileTextIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{file.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatSize(file.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={() => pickFile(null)}
          >
            <Trash2Icon className="w-4 h-4" />
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Import failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Settings: three small inline selects, matching the audio form */}
      <div className="space-x-2">
        <ProjectSelector
          disabled={isSubmitting}
          value={projectId}
          onChange={setProjectId}
          size="sm"
          className="w-max inline-flex"
        />
        <Select
          disabled={isSubmitting}
          size="sm"
          className="w-max inline-flex"
          options={getLanguageOptions(locale)}
          value={language}
          onChange={setLanguage}
          placeholder={t("language")}
          searchPlaceholder={t("searchLanguages")}
        />
        <Select
          disabled={isSubmitting}
          size="sm"
          className="w-max inline-flex"
          options={IMPORT_FORMAT_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          value={format}
          onChange={(v) => setFormat(v as ImportFormat | "auto")}
          placeholder="Format"
        />
      </div>

      <Button type="submit" disabled={!file || isSubmitting} className="w-full">
        {isSubmitting ? "Importing…" : "Import transcript"}
      </Button>
    </form>
  );
}
