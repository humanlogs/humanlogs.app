"use client";

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
import _ from "lodash";
import {
  AlertCircle,
  FileIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { useUserProfile } from "../../../../hooks/use-api";
import { fetchGateway } from "@/hooks/fetch";

type AudioFile = {
  id: string;
  file: File;
  name: string;
  duration: number | null;
  size: number;
};

const supportedLanguages = {
  bel: "Belarusian",
  bos: "Bosnian",
  bul: "Bulgarian",
  cat: "Catalan",
  hrv: "Croatian",
  ces: "Czech",
  dan: "Danish",
  nld: "Dutch",
  eng: "English",
  est: "Estonian",
  fin: "Finnish",
  fra: "Français",
  glg: "Galician",
  deu: "German",
  ell: "Greek",
  hun: "Hungarian",
  isl: "Icelandic",
  ind: "Indonesian",
  ita: "Italian",
  jpn: "Japanese",
  kan: "Kannada",
  lav: "Latvian",
  mkd: "Macedonian",
  msa: "Malay",
  mal: "Malayalam",
  nor: "Norwegian",
  pol: "Polish",
  por: "Portuguese",
  ron: "Romanian",
  rus: "Russian",
  slk: "Slovak",
  spa: "Spanish",
  swe: "Swedish",
  tur: "Turkish",
  ukr: "Ukrainian",
  vie: "Vietnamese",
  hye: "Armenian",
  aze: "Azerbaijani",
  ben: "Bengali",
  yue: "Cantonese",
  fil: "Filipino",
  kat: "Georgian",
  guj: "Gujarati",
  hin: "Hindi",
  kaz: "Kazakh",
  lit: "Lithuanian",
  mlt: "Maltese",
  cmn: "Mandarin",
  mar: "Marathi",
  nep: "Nepali",
  ori: "Odia",
  fas: "Persian",
  srp: "Serbian",
  slv: "Slovenian",
  swa: "Swahili",
  tam: "Tamil",
  tel: "Telugu",
  afr: "Afrikaans",
  ara: "Arabic",
  asm: "Assamese",
  ast: "Asturian",
  mya: "Burmese",
  hau: "Hausa",
  heb: "Hebrew",
  jav: "Javanese",
  kor: "Korean",
  kir: "Kyrgyz",
  ltz: "Luxembourgish",
  mri: "Māori",
  oci: "Occitan",
  pan: "Punjabi",
  tgk: "Tajik",
  tha: "Thai",
  uzb: "Uzbek",
  cym: "Welsh",
  amh: "Amharic",
  lug: "Ganda",
  ibo: "Igbo",
  gle: "Irish",
  khm: "Khmer",
  kur: "Kurdish",
  lao: "Lao",
  mon: "Mongolian",
  nso: "Northern Sotho",
  pus: "Pashto",
  sna: "Shona",
  snd: "Sindhi",
  som: "Somali",
  urd: "Urdu",
  wol: "Wolof",
  xho: "Xhosa",
  yor: "Yoruba",
  zul: "Zulu",
};

export default function NewTranscriptionPage() {
  const t = useTranslations("newTranscription");
  const { locale } = useLocale();
  const { data: user } = useUserProfile();
  const router = useRouter();

  // Form state
  const [audioFiles, setAudioFiles] = React.useState<AudioFile[]>([]);
  const [projectId, setProjectId] = React.useState<string | undefined>();
  const [language, setLanguage] = React.useState<string>(
    Object.keys(supportedLanguages).find((key) => key.startsWith(locale)) ||
      "eng",
  );
  const [speakers, setSpeakers] = React.useState<number>(2);
  const [vocabulary, setVocabulary] = React.useState<string>("Euh, Hmm, Bah");
  const [isDragging, setIsDragging] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
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

      // Check file size (1GB max)
      if (file.size > 1024 * 1024 * 1024) {
        toast.error(`File "${file.name}" is too large (max 1GB)`);
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

    setIsSubmitting(true);

    try {
      // Prepare form data
      const formData = new FormData();
      if (projectId) {
        formData.append("projectId", projectId);
      }
      formData.append("language", language);
      formData.append("speakerCount", speakers.toString());
      formData.append("vocabulary", vocabulary);

      // Add all audio files
      audioFiles.forEach((audioFile, index) => {
        formData.append(`file_${index}`, audioFile.file);
        formData.append(`fileName_${index}`, audioFile.name);
        formData.append(
          `duration_${index}`,
          (audioFile.duration || 0).toString(),
        );
      });

      // Submit to API
      const response = await fetchGateway("/api/transcriptions/create", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create transcription");
      }

      const result = await response.json();
      console.log("Transcription created:", result);

      toast.success("Transcription started successfully!");

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
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <PageLayout title={t("audioFiles")}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Low Credits Warning */}
          {user?.credits !== null && (user?.credits || 0) < 200 && (
            <Alert
              variant="default"
              className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
            >
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-300">
                Low Credits
              </AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                You have {user?.credits || 0} credits remaining. Consider adding
                more credits to continue transcribing.{" "}
                <Link
                  href="/app/account/billing"
                  className="font-semibold underline hover:no-underline"
                >
                  View billing options
                </Link>
              </AlertDescription>
            </Alert>
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
            <div className="border rounded-md w-12 h-12 flex items-center justify-center">
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
                options={_.sortBy(
                  Object.keys(supportedLanguages),
                  (a) => (supportedLanguages as any)[a],
                ).map((lang) => ({
                  label: (supportedLanguages as any)[lang],
                  value: lang,
                }))}
                value={language}
                onChange={setLanguage}
                placeholder={t("language")}
                searchPlaceholder="Search languages..."
              />
              <Select
                disabled={isSubmitting}
                size="sm"
                className="w-max inline-flex"
                options={[1, 2, 3, 4, 5, 32].map((num) => ({
                  label:
                    num === 1
                      ? "Single speaker"
                      : num === 32
                        ? "More than 5 speakers"
                        : `${num.toString()} speakers`,
                  value: num.toString(),
                }))}
                value={speakers.toString()}
                onChange={(value) => setSpeakers(parseInt(value, 10))}
                placeholder={t("language")}
                searchPlaceholder="Search languages..."
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
          </div>

          {/* Submit Button */}
          <div className="flex justify-end items-center gap-2 flex-wrap">
            {estimatedCredits > 0 && (
              <div className="text-muted-foreground w-full text-right text-sm">
                {estimatedCredits} credits
              </div>
            )}
            <Button
              type="submit"
              size="lg"
              variant={"primary"}
              disabled={
                audioFiles.length === 0 || !hasEnoughCredits || isSubmitting
              }
            >
              {isSubmitting ? t("processing") : t("startTranscription")}
            </Button>
          </div>
        </form>
      </PageLayout>

      {/* Rename File Modal */}
      <Dialog open={renameModalOpen} onOpenChange={setRenameModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Audio File</DialogTitle>
            <DialogDescription>
              Enter a new name for your audio file.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit}>
            <div className="px-6">
              <div className="space-y-2">
                <Label htmlFor="file-name">File Name</Label>
                <Input
                  id="file-name"
                  value={tempFileName}
                  onChange={(e) => setTempFileName(e.target.value)}
                  placeholder="e.g., Interview Recording"
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
                Cancel
              </Button>
              <Button type="submit" variant={"primary"}>
                Rename
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
