"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, AlertCircle, CheckCircle2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/components/locale-provider";
import {
  parseSRT,
  validateSRT,
  createWebVTTBlobUrl,
  type SRTValidationError,
  type SRTCue,
} from "@/lib/utils/srt-parser";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const SRTValidator = () => {
  const t = useTranslations("freetools");
  const videoRef = useRef<HTMLVideoElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    SRTValidationError[]
  >([]);
  const [cues, setCues] = useState<SRTCue[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleVideoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        // Cleanup old URL
        if (videoUrl) URL.revokeObjectURL(videoUrl);

        setVideoFile(file);
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
      }
    },
    [videoUrl],
  );

  const handleSRTChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSrtFile(file);

        // Read and parse SRT
        const content = await file.text();

        // Parse cues
        const parsedCues = parseSRT(content);
        setCues(parsedCues);

        // Validate
        const errors = validateSRT(content);
        setValidationErrors(errors);

        // Convert to WebVTT and create blob URL
        if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
        const vttUrl = createWebVTTBlobUrl(content);
        setSubtitleUrl(vttUrl);
      }
    },
    [subtitleUrl],
  );

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("video/")) {
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        setVideoFile(file);
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
      }
    },
    [videoUrl],
  );

  const handleSRTDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (
        file &&
        (file.name.endsWith(".srt") || file.type === "application/x-subrip")
      ) {
        setSrtFile(file);

        const content = await file.text();
        const parsedCues = parseSRT(content);
        setCues(parsedCues);

        const errors = validateSRT(content);
        setValidationErrors(errors);

        if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
        const vttUrl = createWebVTTBlobUrl(content);
        setSubtitleUrl(vttUrl);
      }
    },
    [subtitleUrl],
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Upload Zones */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Video Upload */}
        <Card
          className="border-2 border-dashed border-gray-300 p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
          onDrop={handleVideoDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            type="file"
            id="video-upload"
            className="hidden"
            accept="video/*"
            onChange={handleVideoChange}
          />
          <label htmlFor="video-upload" className="cursor-pointer">
            <div className="flex flex-col items-center gap-4">
              <Upload className="h-10 w-10 text-gray-400" />
              <div>
                <p className="text-base font-semibold text-gray-700">
                  {videoFile ? videoFile.name : t("srtTester.uploadVideo")}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {t("srtTester.dragDropVideo")}
                </p>
              </div>
              <Button variant="outline" type="button" size="sm">
                {t("srtTester.selectVideo")}
              </Button>
            </div>
          </label>
        </Card>

        {/* SRT Upload */}
        <Card
          className="border-2 border-dashed border-gray-300 p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
          onDrop={handleSRTDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            type="file"
            id="srt-upload"
            className="hidden"
            accept=".srt"
            onChange={handleSRTChange}
          />
          <label htmlFor="srt-upload" className="cursor-pointer">
            <div className="flex flex-col items-center gap-4">
              <Upload className="h-10 w-10 text-gray-400" />
              <div>
                <p className="text-base font-semibold text-gray-700">
                  {srtFile ? srtFile.name : t("srtTester.uploadSRT")}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {t("srtTester.dragDropSRT")}
                </p>
              </div>
              <Button variant="outline" type="button" size="sm">
                {t("srtTester.selectSRT")}
              </Button>
            </div>
          </label>
        </Card>
      </div>

      {/* Validation Results */}
      {srtFile && (
        <Card className="p-4">
          <h3 className="font-semibold text-lg mb-3">
            {t("srtTester.validationResults")}
          </h3>
          {validationErrors.length === 0 ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {t("srtTester.noErrors")} ({cues.length}{" "}
                {t("srtTester.subtitles")})
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  {validationErrors.length} {t("srtTester.issuesFound")}
                </AlertDescription>
              </Alert>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {validationErrors.map((error, index) => (
                  <div
                    key={index}
                    className="text-sm p-2 bg-red-50 border border-red-200 rounded"
                  >
                    <span className="font-semibold text-red-700">
                      {error.type}:
                    </span>{" "}
                    <span className="text-red-600">{error.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Video Player with Subtitles */}
      {videoUrl && subtitleUrl && (
        <Card className="p-4">
          <h3 className="font-semibold text-lg mb-3">
            {t("srtTester.preview")}
          </h3>
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full"
              src={videoUrl}
              crossOrigin="anonymous"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              <track
                kind="subtitles"
                src={subtitleUrl}
                srcLang="en"
                label="Subtitles"
                default
              />
            </video>

            {/* Play/Pause Overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex gap-2">
              <Button onClick={togglePlayPause} variant="secondary" size="sm">
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Play
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Privacy Notice */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-900">
          <strong>{t("srtTester.privacyTitle")}:</strong>{" "}
          {t("srtTester.privacyMessage")}
        </p>
      </Card>
    </div>
  );
};
