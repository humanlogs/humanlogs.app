"use client";

import { GuideCallout } from "@/components/guidance/guide-callout";
import { useLocale, useTranslations } from "@/components/locale-provider";
import { PageLayout } from "@/components/page-layout";
import { ProjectSelector } from "@/components/project-selector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ImportTextForm } from "@/components/transcriptions/import-text-form";
import { getLanguageOptions, supportedLanguages } from "@/lib/utils/languages";
import {
  AlertCircle,
  FileIcon,
  FileTextIcon,
  Headphones,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { useUserProfile } from "../../../../hooks/use-api";
import { useQueryClient } from "@tanstack/react-query";
import {
  canConvertToOpusInBrowser,
  convertFileToOpus,
} from "@/lib/audio/client-opus-conversion.browser";

type AudioFile = {
  id: string;
  file: File;
  name: string;
  duration: number | null;
  size: number;
};

// EU (Gladia) servers reject audio longer than this per file.
const EU_MAX_DURATION_SECONDS = 8100;

// Hard limit for a raw upload that the server has to receive as-is.
const SERVER_MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB
// Files we can convert to opus in the browser may be far larger, because only
// the small opus result is uploaded (a 2GB WAV becomes ~50MB of opus).
const CLIENT_CONVERT_MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024; // 4GB

type UploadResult = { ok: boolean; status: number; body: string };

/**
 * Upload a FormData payload via XMLHttpRequest so we can report upload
 * progress (the fetch API does not expose upload progress events).
 */
function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body: xhr.responseText });
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload aborted"));

    xhr.send(formData);
  });
}


function NewTranscriptionForm() {
  const t = useTranslations("newTranscription");
  const { locale } = useLocale();
  const { data: user } = useUserProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Form state
  const [audioFiles, setAudioFiles] = React.useState<AudioFile[]>([]);
  // When arriving from a study (`?projectId=...`), pre-scope the upload to it;
  // otherwise fall back to the last-used project stored in localStorage.
  const [projectId, setProjectId] = React.useState<string | undefined>(() => {
    const fromQuery = searchParams.get("projectId");
    if (fromQuery) return fromQuery;
    const saved = localStorage.getItem("transcription_project");
    return saved || undefined;
  });
  const [language, setLanguage] = React.useState<string>(() => {
    const saved = localStorage.getItem("transcription_language");
    if (saved) return saved;
    return (
      Object.keys(supportedLanguages).find((key) => key.startsWith(locale)) ||
      "eng"
    );
  });
  const [speakers, setSpeakers] = React.useState<number>(2);
  const [provider, setProvider] = React.useState<"eu" | "us">(() => {
    if (typeof window === "undefined") return "eu";
    const saved = localStorage.getItem("transcription_stt_provider");
    return saved === "us" ? "us" : "eu";
  });
  const providerTouchedRef = React.useRef(false);
  const [vocabulary, setVocabulary] = React.useState<string>("Euh, Hmm, Bah");
  const [tagAudioEvents, setTagAudioEvents] = React.useState<boolean>(() => {
    const saved = localStorage.getItem("transcription_tag_audio_events");
    if (saved === null) return true;
    return saved === "true";
  });
  const [isDragging, setIsDragging] = React.useState(false);
  // Whether the user is transcribing audio/video or importing an existing text
  // document. Text imports skip STT entirely.
  const [mode, setMode] = React.useState<"audio" | "text">("audio");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // Upload progress (0-100). Null while not uploading.
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(
    null,
  );
  // Client-side opus conversion progress. Null while not converting.
  const [conversionState, setConversionState] = React.useState<{
    current: number;
    total: number;
    ratio: number;
  } | null>(null);
  const [playingAudioId, setPlayingAudioId] = React.useState<string | null>(
    null,
  );
  const [renameModalOpen, setRenameModalOpen] = React.useState(false);
  const [renamingFile, setRenamingFile] = React.useState<AudioFile | null>(
    null,
  );
  const [tempFileName, setTempFileName] = React.useState("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const audioRefs = React.useRef<Map<string, HTMLAudioElement>>(new Map());

  // Load speaker count from localStorage and user credits on mount
  React.useEffect(() => {
    const savedSpeakers = localStorage.getItem("transcription_speakers");
    if (savedSpeakers) {
      const count = parseInt(savedSpeakers, 10);
      if (!isNaN(count) && count > 0) {
        setSpeakers(count);
      }
    }
  }, []);

  // Save speaker count to localStorage when it changes
  React.useEffect(() => {
    localStorage.setItem("transcription_speakers", speakers.toString());
  }, [speakers]);

  // Save language to localStorage when it changes
  React.useEffect(() => {
    localStorage.setItem("transcription_language", language);
  }, [language]);

  // Save tagAudioEvents to localStorage when it changes
  React.useEffect(() => {
    localStorage.setItem(
      "transcription_tag_audio_events",
      tagAudioEvents.toString(),
    );
  }, [tagAudioEvents]);

  // Save projectId to localStorage when it changes
  React.useEffect(() => {
    if (projectId) {
      localStorage.setItem("transcription_project", projectId);
    } else {
      localStorage.removeItem("transcription_project");
    }
  }, [projectId]);

  // Seed the model preference from the user's saved data residency, unless the
  // user already has a remembered last choice in localStorage or changed it.
  React.useEffect(() => {
    if (providerTouchedRef.current) return;
    const saved = localStorage.getItem("transcription_stt_provider");
    if (!saved && (user?.dataResidency === "eu" || user?.dataResidency === "us")) {
      setProvider(user.dataResidency);
    }
  }, [user?.dataResidency]);

  // Whether to offer the EU/US choice (both providers configured on this deployment)
  const showProviderChoice =
    !!user?.availableSttProviders?.eu && !!user?.availableSttProviders?.us;

  // The provider that will actually be used for this transcription. When the
  // user can choose, it follows their selection; otherwise it's whichever
  // provider is configured on this deployment.
  const effectiveProvider: "eu" | "us" = showProviderChoice
    ? provider
    : user?.availableSttProviders?.us && !user?.availableSttProviders?.eu
      ? "us"
      : "eu";

  // Files that exceed the EU per-file duration limit (only relevant on EU).
  const oversizedEuFiles =
    effectiveProvider === "eu"
      ? audioFiles.filter((f) => (f.duration || 0) > EU_MAX_DURATION_SECONDS)
      : [];
  const hasOversizedEuFiles = oversizedEuFiles.length > 0;

  // Calculate audio duration
  const loadAudioDuration = async (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);

      audio.addEventListener("loadedmetadata", () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      });

      audio.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        resolve(0);
      });

      audio.src = url;
    });
  };

  // Handle file selection
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: AudioFile[] = [];
    const supportedFormats = [
      // Audio formats
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/x-m4a",
      "audio/m4a",
      "audio/flac",
      "audio/aac",
      "audio/ogg",
      "audio/opus",
      "audio/webm",
      "audio/x-ms-wma",
      "audio/aiff",
      "audio/x-aiff",
      // Video formats (audio will be extracted)
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/webm",
      "video/x-flv",
      "video/x-ms-wmv",
      "video/mpeg",
      "video/3gpp",
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file type - accept common audio and video extensions
      if (
        !supportedFormats.includes(file.type) &&
        !file.name.match(
          /\.(mp3|wav|m4a|flac|aac|ogg|opus|wma|aiff|mp4|mov|avi|mkv|webm|flv|wmv|mpeg|mpg|3gp)$/i,
        )
      ) {
        continue;
      }

      // Size limit depends on the path: files we can convert to opus in the
      // browser are allowed to be much larger (only the small opus is uploaded);
      // everything else must fit the server's raw-upload limit.
      const canConvert = canConvertToOpusInBrowser(file).ok;
      const maxSize = canConvert
        ? CLIENT_CONVERT_MAX_FILE_SIZE
        : SERVER_MAX_FILE_SIZE;
      if (file.size > maxSize) {
        toast.error(
          canConvert
            ? `File "${file.name}" is too large (max 4GB)`
            : `File "${file.name}" is too large (max 300MB on this device)`,
        );
        continue;
      }

      const duration = await loadAudioDuration(file);
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");

      newFiles.push({
        id: Math.random().toString(36).substring(7),
        file,
        name: nameWithoutExt,
        duration,
        size: file.size,
      });
    }

    setAudioFiles((prev) => [...prev, ...newFiles]);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove file
  const removeFile = (id: string) => {
    // Clean up audio element if it exists
    const audioElement = audioRefs.current.get(id);
    if (audioElement) {
      audioElement.pause();
      URL.revokeObjectURL(audioElement.src);
      audioRefs.current.delete(id);
    }

    // Stop playing if this was the playing audio
    if (playingAudioId === id) {
      setPlayingAudioId(null);
    }

    setAudioFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Update file name
  const updateFileName = (id: string, newName: string) => {
    setAudioFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: newName } : f)),
    );
  };

  // Play/pause audio
  const togglePlayPause = (audioFile: AudioFile) => {
    const audioElement = audioRefs.current.get(audioFile.id);

    if (!audioElement) {
      // Create new audio element if it doesn't exist
      const newAudio = new Audio(URL.createObjectURL(audioFile.file));
      audioRefs.current.set(audioFile.id, newAudio);

      // Handle audio end
      newAudio.addEventListener("ended", () => {
        setPlayingAudioId(null);
      });

      // Play the audio
      newAudio.play();
      setPlayingAudioId(audioFile.id);
    } else if (playingAudioId === audioFile.id) {
      // Pause current audio
      audioElement.pause();
      setPlayingAudioId(null);
    } else {
      // Pause all other audios
      audioRefs.current.forEach((audio, id) => {
        if (id !== audioFile.id) {
          audio.pause();
        }
      });

      // Play this audio
      audioElement.play();
      setPlayingAudioId(audioFile.id);
    }
  };

  // Open rename modal
  const openRenameModal = (audioFile: AudioFile) => {
    setRenamingFile(audioFile);
    setTempFileName(audioFile.name);
    setRenameModalOpen(true);
  };

  // Submit rename
  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!renamingFile || !tempFileName.trim()) {
      toast.error("Please enter a file name");
      return;
    }

    updateFileName(renamingFile.id, tempFileName.trim());
    setRenameModalOpen(false);
    setRenamingFile(null);
    setTempFileName("");
  };

  // Cleanup audio elements on unmount or file removal
  React.useEffect(() => {
    const audios = audioRefs.current;
    return () => {
      audios.forEach((audio) => {
        audio.pause();
        URL.revokeObjectURL(audio.src);
      });
      audios.clear();
    };
  }, []);

  // Calculate totals
  const totalSeconds = audioFiles.reduce(
    (sum, f) => sum + (f.duration || 0),
    0,
  );
  const totalMinutes = Math.ceil(totalSeconds / 60);
  const estimatedCredits = totalMinutes;
  const hasEnoughCredits =
    user?.credits === null || (user?.credits || 0) >= estimatedCredits;

  // Format helpers
  const formatDuration = (seconds: number | null) => {
    if (seconds === null || seconds === 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (audioFiles.length === 0) {
      toast.error("Please add at least one audio file");
      return;
    }

    if (!hasEnoughCredits) {
      toast.error(t("insufficientCredits"));
      return;
    }

    if (hasOversizedEuFiles) {
      toast.error(
        t("euDurationLimitError", {
          minutes: Math.floor(EU_MAX_DURATION_SECONDS / 60),
        }),
      );
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(null);
    setConversionState(null);

    try {
      // Phase 1: convert each file to standardized opus in the browser when the
      // device supports it. This offloads compression (and its RAM cost) from
      // the server and shrinks the upload. Any failure falls back to uploading
      // the raw file, which the server then converts.
      const prepared: {
        file: File;
        name: string;
        duration: number;
        converted: boolean;
      }[] = [];

      for (let i = 0; i < audioFiles.length; i++) {
        const audioFile = audioFiles[i];
        let file = audioFile.file;
        let converted = false;

        if (canConvertToOpusInBrowser(file).ok) {
          try {
            setConversionState({
              current: i + 1,
              total: audioFiles.length,
              ratio: 0,
            });
            file = await convertFileToOpus(file, (ratio) =>
              setConversionState({
                current: i + 1,
                total: audioFiles.length,
                ratio,
              }),
            );
            converted = true;
          } catch (error) {
            console.error(
              `Client-side opus conversion failed for "${audioFile.file.name}"; uploading raw file instead:`,
              error,
            );
            file = audioFile.file;
            converted = false;

            // The file was only accepted above because we expected to convert
            // it here: the raw source may be far over what the server accepts.
            // Fail it now with a message that says why, instead of letting the
            // upload be truncated and rejected as a generic error.
            if (file.size > SERVER_MAX_FILE_SIZE) {
              throw new Error(
                t("conversionFailedTooLarge", { name: audioFile.name }),
              );
            }
          }
        }

        prepared.push({
          file,
          name: audioFile.name,
          duration: audioFile.duration || 0,
          converted,
        });
      }

      setConversionState(null);
      setUploadProgress(0);

      // Phase 2: build and upload the form data.
      const formData = new FormData();
      if (projectId) {
        formData.append("projectId", projectId);
      }
      formData.append("language", language);
      formData.append("speakerCount", speakers.toString());
      formData.append("vocabulary", vocabulary);
      formData.append("tagAudioEvents", tagAudioEvents.toString());
      if (showProviderChoice) {
        formData.append("provider", provider);
      }

      // Add all (possibly browser-converted) audio files.
      prepared.forEach((item, index) => {
        formData.append(`file_${index}`, item.file);
        formData.append(`fileName_${index}`, item.name);
        formData.append(`duration_${index}`, item.duration.toString());
        if (item.converted) {
          // Signal that this is already standardized opus so the server skips
          // its own ffmpeg re-encoding step.
          formData.append(`converted_${index}`, "opus");
        }
      });

      // Submit to API via XHR so we can show real upload progress.
      const response = await uploadWithProgress(
        "/api/transcriptions/create",
        formData,
        setUploadProgress,
      );

      if (response.status === 429) {
        document.location.href = "/app/overload";
        return;
      }
      if (response.status === 401) {
        document.location.href = "/app/login";
        return;
      }

      if (!response.ok) {
        let message = "Failed to create transcription";
        try {
          message = JSON.parse(response.body).error || message;
        } catch {
          // non-JSON error body, keep default message
        }
        throw new Error(message);
      }

      const result = JSON.parse(response.body);

      toast.success("Transcription started successfully!");

      queryClient.invalidateQueries({ queryKey: ["transcriptions"] });

      // Socket.io will automatically update the sidebar via React Query

      // Redirect to the first transcription or home
      if (result.transcriptions && result.transcriptions.length > 0) {
        router.push(`/app/transcription/${result.transcriptions[0]}`);
      } else {
        router.push("/app/");
      }
    } catch (error) {
      console.error("Error creating transcription:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create transcription. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
      setConversionState(null);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <PageLayout title={t("title")}>
        {/* Source mode: transcribe audio/video vs import an existing text doc */}
        <div className="mb-6 inline-flex rounded-lg border p-1 gap-1">
          <Button
            type="button"
            variant={mode === "audio" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("audio")}
          >
            <Headphones className="w-4 h-4" />
            Audio / video
          </Button>
          <Button
            type="button"
            variant={mode === "text" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("text")}
          >
            <FileTextIcon className="w-4 h-4" />
            Text / document
          </Button>
        </div>

        {mode === "text" && (
          <ImportTextForm
            defaultProjectId={projectId}
            defaultLanguage={language}
          />
        )}

        <form
          onSubmit={handleSubmit}
          className={`space-y-6 ${mode === "text" ? "hidden" : ""}`}
        >
          {/* Low Credits Warning */}
          {user?.credits !== null && (user?.credits || 0) < 200 && (
            <GuideCallout
              icon={<AlertCircle className="h-5 w-5" />}
              title={t("lowCredits")}
              description={t("lowCreditsDescription", {
                credits: user?.credits || 0,
              })}
              action={{
                label: t("viewBillingOptions"),
                onClick: () => router.push("/app/account/billing"),
              }}
            />
          )}

          {/* Drag & Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 flex items-center justify-center space-x-4 text-left transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="border rounded-md w-12 h-12 flex items-center justify-center shrink-0">
              <UploadIcon className="w-6 h-6 text-black dark:text-white" />
            </div>
            <div>
              <p className="text-lg font-medium">{t("dragDrop")}</p>
              <p className="text-sm text-muted-foreground">
                {t("supportedFormats")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*,.mp3,.wav,.m4a,.flac,.aac,.ogg,.opus,.wma,.aiff,.mp4,.mov,.avi,.mkv,.webm,.flv,.wmv,.mpeg,.mpg,.3gp"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          </div>

          {/* File List */}
          {audioFiles.length > 0 && (
            <div className="mt-6 space-y-3">
              {audioFiles.map((audioFile) => (
                <div
                  key={audioFile.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="rounded-md w-12 h-12 flex items-center justify-center bg-muted">
                    <FileIcon className="w-6 h-6 text-black" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <span className="group/label font-medium">
                      {audioFile.name}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => openRenameModal(audioFile)}
                        className="ml-1 shrink-0 opacity-0 group-hover/label:opacity-100 transition-opacity"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </Button>
                    </span>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>
                        {formatDuration(audioFile.duration)} |{" "}
                        {formatSize(audioFile.size)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-lg"
                      onClick={() => togglePlayPause(audioFile)}
                      className="shrink-0"
                    >
                      {playingAudioId === audioFile.id ? (
                        <PauseIcon fill="current" className="w-4 h-4" />
                      ) : (
                        <PlayIcon fill="current" className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-lg"
                      onClick={() => removeFile(audioFile.id)}
                      className="shrink-0"
                    >
                      <Trash2Icon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Settings Section */}
          <div className="space-y-6">
            {/* Project */}
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
                options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 32].map((num) => ({
                  label:
                    num === 1
                      ? t("singleSpeaker")
                      : num === 32
                        ? t("moreThanTenSpeakers")
                        : t("speakersCount", { count: num }),
                  value: num.toString(),
                }))}
                value={speakers.toString()}
                onChange={(value) => setSpeakers(parseInt(value, 10))}
                placeholder={t("language")}
                searchPlaceholder={t("searchLanguages")}
              />
            </div>

            {/* Custom Vocabulary */}
            <div className="space-y-2">
              <Label htmlFor="vocabulary">{t("vocabulary")}</Label>
              <Textarea
                id="vocabulary"
                value={vocabulary}
                onChange={(e) => setVocabulary(e.target.value)}
                placeholder={t("vocabularyPlaceholder")}
                rows={3}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                {t("vocabularyHelper")}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="tag-audio-events"
                checked={tagAudioEvents}
                onCheckedChange={(checked) =>
                  setTagAudioEvents(checked === true)
                }
                disabled={isSubmitting}
              />
              <Label
                htmlFor="tag-audio-events"
                className="text-sm font-medium leading-none"
              >
                {t("tagAudioEvents")}
              </Label>
            </div>
          </div>

          {/* EU duration limit warning */}
          {hasOversizedEuFiles && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("euDurationLimitTitle")}</AlertTitle>
              <AlertDescription>
                {t("euDurationLimitDescription", {
                  minutes: Math.floor(EU_MAX_DURATION_SECONDS / 60),
                  files: oversizedEuFiles.map((f) => f.name).join(", "),
                })}
              </AlertDescription>
            </Alert>
          )}

          {/* Conversion progress (client-side opus, before upload) */}
          {isSubmitting && conversionState !== null && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>
                  {t("converting")}
                  {conversionState.total > 1
                    ? ` (${conversionState.current}/${conversionState.total})`
                    : ""}
                </span>
                <span className="text-muted-foreground">
                  {Math.round(conversionState.ratio * 100)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{
                    width: `${Math.round(conversionState.ratio * 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("convertingNote")}
              </p>
            </div>
          )}

          {/* Upload progress */}
          {isSubmitting && uploadProgress !== null && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>{t("uploading")}</span>
                <span className="text-muted-foreground">{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("uploadingNote")}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end items-center gap-2 flex-wrap">
            {estimatedCredits > 0 && (
              <div className="text-muted-foreground w-full text-right text-sm">
                {estimatedCredits} credits
              </div>
            )}
            {showProviderChoice && (
              <Select
                disabled={isSubmitting}
                size="sm"
                className="w-max inline-flex"
                options={[
                  { label: t("providerEu"), value: "eu" },
                  { label: t("providerUs"), value: "us" },
                ]}
                value={provider}
                onChange={(value) => {
                  providerTouchedRef.current = true;
                  const next = value === "us" ? "us" : "eu";
                  setProvider(next);
                  localStorage.setItem("transcription_stt_provider", next);
                }}
                placeholder={t("provider")}
              />
            )}
            <Button
              type="submit"
              size="lg"
              variant={"primary"}
              disabled={
                audioFiles.length === 0 ||
                !hasEnoughCredits ||
                hasOversizedEuFiles ||
                isSubmitting
              }
            >
              {isSubmitting
                ? conversionState !== null
                  ? `${t("converting")} ${Math.round(conversionState.ratio * 100)}%`
                  : uploadProgress !== null && uploadProgress < 100
                    ? `${t("uploading")} ${uploadProgress}%`
                    : t("processing")
                : t("startTranscription")}
            </Button>
          </div>
        </form>
      </PageLayout>

      {/* Rename File Modal */}
      <Dialog open={renameModalOpen} onOpenChange={setRenameModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("renameAudioFile")}</DialogTitle>
            <DialogDescription>
              {t("renameAudioFileDescription")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit}>
            <div className="px-6">
              <div className="space-y-2">
                <Label htmlFor="file-name">{t("fileName")}</Label>
                <Input
                  id="file-name"
                  value={tempFileName}
                  onChange={(e) => setTempFileName(e.target.value)}
                  placeholder={t("fileNamePlaceholder")}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameModalOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" variant={"primary"}>
                {t("rename")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// useSearchParams() must be wrapped in a Suspense boundary for the production build.
export default function NewTranscriptionPage() {
  return (
    <React.Suspense fallback={null}>
      <NewTranscriptionForm />
    </React.Suspense>
  );
}
