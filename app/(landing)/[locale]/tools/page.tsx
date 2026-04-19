"use client";

import { useTranslations } from "@/components/locale-provider";
import { AudioConverter } from "./components/audio-converter";
import Link from "next/link";
import { FileAudio, FileVideo, Gauge, Repeat, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function ToolsPage() {
  const t = useTranslations("freetools");

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 md:px-6">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-black md:text-5xl mb-4">
            {t("title")}
          </h1>
          <p className="text-lg text-gray-600 md:text-xl">{t("subtitle")}</p>
        </div>

        {/* Popular Tools Grid */}
        <div className="max-w-5xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-black mb-6 text-center">
            {t("popularTools")}
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <Link href="/tools/video-to-audio">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <FileVideo className="h-8 w-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-lg mb-2">
                  {t("tools.videoToAudio.title")}
                </h3>
                <p className="text-sm text-gray-600">
                  {t("tools.videoToAudio.description")}
                </p>
              </Card>
            </Link>

            <Link href="/tools/audio-compression">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <Gauge className="h-8 w-8 text-green-600 mb-3" />
                <h3 className="font-semibold text-lg mb-2">
                  {t("tools.audioCompression.title")}
                </h3>
                <p className="text-sm text-gray-600">
                  {t("tools.audioCompression.description")}
                </p>
              </Card>
            </Link>

            <Link href="/tools/mp3-to-wav">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <Repeat className="h-8 w-8 text-purple-600 mb-3" />
                <h3 className="font-semibold text-lg mb-2">
                  {t("tools.mp3ToWav.title")}
                </h3>
                <p className="text-sm text-gray-600">
                  {t("tools.mp3ToWav.description")}
                </p>
              </Card>
            </Link>

            <Link href="/tools/srt-tester">
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <FileText className="h-8 w-8 text-orange-600 mb-3" />
                <h3 className="font-semibold text-lg mb-2">
                  {t("tools.srtTester.title")}
                </h3>
                <p className="text-sm text-gray-600">
                  {t("tools.srtTester.description")}
                </p>
              </Card>
            </Link>
          </div>
        </div>

        {/* Converter */}
        <AudioConverter />

        {/* All Tools Section */}
        <div className="max-w-4xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-black mb-6">
            {t("allTools")}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/tools/srt-tester"
              className="text-blue-600 hover:underline"
            >
              SRT Subtitle Tester & Validator
            </Link>
            <Link
              href="/tools/video-to-audio"
              className="text-blue-600 hover:underline"
            >
              Video to Audio Converter
            </Link>
            <Link
              href="/tools/mp3-to-wav"
              className="text-blue-600 hover:underline"
            >
              MP3 to WAV Converter
            </Link>
            <Link
              href="/tools/wav-to-mp3"
              className="text-blue-600 hover:underline"
            >
              WAV to MP3 Converter
            </Link>
            <Link
              href="/tools/m4a-to-mp3"
              className="text-blue-600 hover:underline"
            >
              M4A to MP3 Converter
            </Link>
            <Link
              href="/tools/flac-to-mp3"
              className="text-blue-600 hover:underline"
            >
              FLAC to MP3 Converter
            </Link>
            <Link
              href="/tools/ogg-to-mp3"
              className="text-blue-600 hover:underline"
            >
              OGG to MP3 Converter
            </Link>
            <Link
              href="/tools/audio-compression"
              className="text-blue-600 hover:underline"
            >
              Audio Compression Tool
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 md:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-black mb-8 text-center">
            {t("features.title")}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileAudio className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                {t("features.privacy.title")}
              </h3>
              <p className="text-gray-600 text-sm">
                {t("features.privacy.description")}
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gauge className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                {t("features.fast.title")}
              </h3>
              <p className="text-gray-600 text-sm">
                {t("features.fast.description")}
              </p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Repeat className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                {t("features.free.title")}
              </h3>
              <p className="text-gray-600 text-sm">
                {t("features.free.description")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
