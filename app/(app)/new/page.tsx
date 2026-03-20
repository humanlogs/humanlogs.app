"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "@/components/locale-provider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  UploadIcon,
  XIcon,
  MinusIcon,
  PlusIcon,
  AlertCircleIcon,
  FileAudioIcon,
} from "lucide-react";

type AudioFile = {
  id: string;
  file: File;
  name: string;
  duration: number | null;
  size: number;
};

export default function NewTranscriptionPage() {
  const t = useTranslations("newTranscription");
  const tLang = useTranslations("sidebar.languages");
  const { locale } = useLocale();
  const router = useRouter();

  // Form state
  const [audioFiles, setAudioFiles] = React.useState<AudioFile[]>([]);
  const [language, setLanguage] = React.useState<string>(locale);
  const [speakers, setSpeakers] = React.useState<number>(2);
  const [vocabulary, setVocabulary] = React.useState<string>("Euh, Hmm");
  const [isDragging, setIsDragging] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [userCredits, setUserCredits] = React.useState<number | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load speaker count from localStorage and user credits on mount
  React.useEffect(() => {
    const savedSpeakers = localStorage.getItem("transcription_speakers");
    if (savedSpeakers) {
      const count = parseInt(savedSpeakers, 10);
      if (!isNaN(count) && count > 0) {
        setSpeakers(count);
      }
    }

    // Fetch user credits
    fetch("/api/user")
      .then((res) => res.json())
      .then((data) => {
        const available = (data.creditsRefill || 1000) - (data.credits || 0);
        setUserCredits(Math.max(0, available));
      })
      .catch((err) => console.error("Error fetching credits:", err));
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
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/x-m4a",
      "audio/flac",
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file type
      if (
        !supportedFormats.includes(file.type) &&
        !file.name.match(/\.(mp3|wav|m4a|flac)$/i)
      ) {
        continue;
      }

      // Check file size (500MB max)
      if (file.size > 500 * 1024 * 1024) {
        toast.error(`File "${file.name}" is too large (max 500MB)`);
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
    setAudioFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Update file name
  const updateFileName = (id: string, newName: string) => {
    setAudioFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: newName } : f)),
    );
  };

  // Calculate totals
  const totalSeconds = audioFiles.reduce(
    (sum, f) => sum + (f.duration || 0),
    0,
  );
  const totalMinutes = Math.ceil(totalSeconds / 60);
  const estimatedCredits = totalMinutes;
  const hasEnoughCredits =
    userCredits === null || userCredits >= estimatedCredits;

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
      const response = await fetch("/api/transcriptions/create", {
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
        router.push(`/transcription/${result.transcriptions[0]}`);
      } else {
        router.push("/");
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
    <div className="flex flex-col flex-1 p-8 overflow-auto">
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Audio Files Section */}
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">{t("audioFiles")}</h2>

            {/* Drag & Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">{t("dragDrop")}</p>
              <p className="text-sm text-muted-foreground">
                {t("supportedFormats")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/flac,.mp3,.wav,.m4a,.flac"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>

            {/* File List */}
            {audioFiles.length > 0 ? (
              <div className="mt-6 space-y-3">
                {audioFiles.map((audioFile) => (
                  <div
                    key={audioFile.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <FileAudioIcon className="w-10 h-10 text-primary shrink-0" />

                    <div className="flex-1 min-w-0 space-y-2">
                      <Input
                        value={audioFile.name}
                        onChange={(e) =>
                          updateFileName(audioFile.id, e.target.value)
                        }
                        className="font-medium"
                        placeholder={t("fileName")}
                      />
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>
                          {t("duration")}: {formatDuration(audioFile.duration)}
                        </span>
                        <span>
                          {t("size")}: {formatSize(audioFile.size)}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(audioFile.id)}
                      className="shrink-0"
                    >
                      <XIcon className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-center text-muted-foreground">
                {t("noFiles")}
              </p>
            )}
          </div>

          {/* Settings Section */}
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-6">{t("settings")}</h2>

            <div className="space-y-6">
              {/* Language */}
              <div className="space-y-2">
                <Label htmlFor="language">{t("language")}</Label>
                <Select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">{tLang("en")}</option>
                  <option value="fr">{tLang("fr")}</option>
                  <option value="es">{tLang("es")}</option>
                  <option value="de">{tLang("de")}</option>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("languageHelper")}
                </p>
              </div>

              {/* Number of Speakers */}
              <div className="space-y-2">
                <Label htmlFor="speakers">{t("speakers")}</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setSpeakers(Math.max(1, speakers - 1))}
                    disabled={speakers <= 1}
                  >
                    <MinusIcon className="w-4 h-4" />
                  </Button>
                  <Input
                    id="speakers"
                    type="number"
                    min="1"
                    max="20"
                    value={speakers}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0 && val <= 20) {
                        setSpeakers(val);
                      }
                    }}
                    className="w-20 text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setSpeakers(Math.min(20, speakers + 1))}
                    disabled={speakers >= 20}
                  >
                    <PlusIcon className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("speakersHelper")}
                </p>
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
                />
                <p className="text-xs text-muted-foreground">
                  {t("vocabularyHelper")}
                </p>
              </div>
            </div>
          </div>

          {/* Summary Section */}
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-6">{t("summary")}</h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">
                  {t("totalDuration")}
                </span>
                <span className="text-lg font-semibold">
                  {formatDuration(totalSeconds)} ({totalMinutes} min)
                </span>
              </div>

              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">
                  {t("estimatedCredits")}
                </span>
                <span className="text-lg font-semibold">
                  {estimatedCredits}{" "}
                  {estimatedCredits === 1 ? "credit" : "credits"}
                </span>
              </div>

              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">
                  {t("availableCredits")}
                </span>
                <span className="text-lg font-semibold">
                  {userCredits === null ? "..." : userCredits}
                </span>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {t("creditsInfo")}
              </p>

              {!hasEnoughCredits && audioFiles.length > 0 && (
                <div className="flex items-start gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircleIcon className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">
                    {t("insufficientCredits")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={
                audioFiles.length === 0 || !hasEnoughCredits || isSubmitting
              }
              className="min-w-[200px]"
            >
              {isSubmitting ? t("processing") : t("startTranscription")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
