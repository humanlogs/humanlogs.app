"use client";

import { useState, useCallback } from "react";
import { Upload, Download, Loader2, FileAudio, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { convertAudioFormat } from "@/lib/audio/audio-conversion.browser";
import { useTranslations } from "@/components/locale-provider";

export type ConversionType =
  | "video-to-audio"
  | "audio-compression"
  | "mp3-to-wav"
  | "wav-to-mp3"
  | "m4a-to-mp3"
  | "flac-to-mp3"
  | "ogg-to-mp3"
  | "general-conversion";

interface AudioConverterProps {
  initialConversionType?: ConversionType;
  initialOutputFormat?: string;
}

export const AudioConverter = ({
  initialConversionType = "general-conversion",
  initialOutputFormat = "mp3",
}: AudioConverterProps) => {
  const t = useTranslations("freetools");
  const [file, setFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState(initialOutputFormat);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        setConvertedBlob(null);
      }
    },
    [],
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setConvertedBlob(null);
    }
  }, []);

  const handleConvert = async () => {
    if (!file) return;

    setIsConverting(true);
    try {
      const blob = await convertAudioFormat(file, outputFormat);
      setConvertedBlob(blob);
      toast.success(t("converter.conversionSuccess"));
    } catch (error) {
      console.error("Conversion error:", error);
      toast.error(t("converter.conversionError"));
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!convertedBlob || !file) return;

    const url = URL.createObjectURL(convertedBlob);
    const link = document.createElement("a");
    link.href = url;
    const baseFileName = file.name.replace(/\.[^/.]+$/, "");
    link.download = `${baseFileName}.${outputFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const acceptedFormats =
    initialConversionType === "video-to-audio" ? "video/*,audio/*" : "audio/*";

  const isVideoConversion = file?.type.startsWith("video/");

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Upload Zone */}
      <Card
        className="border-2 border-dashed border-gray-300 p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept={acceptedFormats}
          onChange={handleFileChange}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-4">
            {isVideoConversion ? (
              <FileVideo className="h-12 w-12 text-gray-400" />
            ) : (
              <FileAudio className="h-12 w-12 text-gray-400" />
            )}
            <div>
              <p className="text-lg font-semibold text-gray-700">
                {file ? file.name : t("converter.uploadPrompt")}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {t("converter.dragDrop")}
              </p>
            </div>
            <Button variant="outline" type="button">
              <Upload className="h-4 w-4 mr-2" />
              {t("converter.selectFile")}
            </Button>
          </div>
        </label>
      </Card>

      {/* Format Selection */}
      {file && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("converter.outputFormat")}
            </label>
            <Select
              value={outputFormat}
              onChange={setOutputFormat}
              className="w-full"
              options={["MP3", "WAV", "M4A", "OGG", "FLAC", "AAC"].map(
                (format) => ({ value: format.toLowerCase(), label: format }),
              )}
            />
          </div>

          {/* File Info */}
          <Card className="p-4 bg-gray-50">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">
                  {t("converter.fileName")}:
                </span>
                <p className="font-medium truncate">{file.name}</p>
              </div>
              <div>
                <span className="text-gray-500">
                  {t("converter.fileSize")}:
                </span>
                <p className="font-medium">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div>
                <span className="text-gray-500">
                  {t("converter.inputFormat")}:
                </span>
                <p className="font-medium">{file.type || "Unknown"}</p>
              </div>
              <div>
                <span className="text-gray-500">
                  {t("converter.targetFormat")}:
                </span>
                <p className="font-medium uppercase">{outputFormat}</p>
              </div>
            </div>
          </Card>

          {/* Convert Button */}
          <Button
            onClick={handleConvert}
            disabled={isConverting}
            className="w-full"
            size="lg"
          >
            {isConverting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("converter.converting")}
              </>
            ) : (
              t("converter.convert")
            )}
          </Button>

          {/* Download Button */}
          {convertedBlob && (
            <Button
              onClick={handleDownload}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Download className="h-4 w-4 mr-2" />
              {t("converter.download")}
            </Button>
          )}
        </div>
      )}

      {/* Privacy Notice */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-900">
          <strong>{t("converter.privacyTitle")}:</strong>{" "}
          {t("converter.privacyMessage")}
        </p>
      </Card>
    </div>
  );
};
