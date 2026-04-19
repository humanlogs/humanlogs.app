import { getTranslations } from "next-intl/server";
import { AudioConverter } from "../components/audio-converter";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

interface ConversionPageProps {
  params: Promise<{ "from-to": string }>;
}

// Parse the conversion type from URL
function parseConversionType(fromTo: string) {
  const normalized = fromTo.toLowerCase();

  // Map of URL patterns to conversion types and formats
  const conversions: Record<
    string,
    {
      type: string;
      outputFormat: string;
      title: string;
      description: string;
    }
  > = {
    "video-to-audio": {
      type: "video-to-audio",
      outputFormat: "mp3",
      title: "Video to Audio Converter",
      description:
        "Extract audio from video files (MP4, AVI, MOV, etc.) - Free, fast, and completely private",
    },
    "audio-compression": {
      type: "audio-compression",
      outputFormat: "mp3",
      title: "Audio Compression Tool",
      description:
        "Reduce audio file size while maintaining quality - Free, fast, and completely private",
    },
    "mp3-to-wav": {
      type: "mp3-to-wav",
      outputFormat: "wav",
      title: "MP3 to WAV Converter",
      description:
        "Convert MP3 files to uncompressed WAV format - Free, fast, and completely private",
    },
    "wav-to-mp3": {
      type: "wav-to-mp3",
      outputFormat: "mp3",
      title: "WAV to MP3 Converter",
      description:
        "Convert WAV files to MP3 format - Free, fast, and completely private",
    },
    "m4a-to-mp3": {
      type: "m4a-to-mp3",
      outputFormat: "mp3",
      title: "M4A to MP3 Converter",
      description:
        "Convert M4A files to MP3 format - Free, fast, and completely private",
    },
    "flac-to-mp3": {
      type: "flac-to-mp3",
      outputFormat: "mp3",
      title: "FLAC to MP3 Converter",
      description:
        "Convert FLAC files to MP3 format - Free, fast, and completely private",
    },
    "ogg-to-mp3": {
      type: "ogg-to-mp3",
      outputFormat: "mp3",
      title: "OGG to MP3 Converter",
      description:
        "Convert OGG files to MP3 format - Free, fast, and completely private",
    },
    "aac-to-mp3": {
      type: "aac-to-mp3",
      outputFormat: "mp3",
      title: "AAC to MP3 Converter",
      description:
        "Convert AAC files to MP3 format - Free, fast, and completely private",
    },
  };

  // Return matched conversion or default
  return (
    conversions[normalized] || {
      type: "general-conversion",
      outputFormat: "mp3",
      title: "Audio Format Converter",
      description:
        "Convert audio files between different formats - Free, fast, and completely private",
    }
  );
}

export async function generateMetadata({
  params,
}: ConversionPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const conversion = parseConversionType(resolvedParams["from-to"]);

  return {
    title: `${conversion.title} - Free Online Tool | HumanLogs`,
    description: `${conversion.description}. No uploads, no tracking, all processing happens in your browser using WebAssembly.`,
    keywords: [
      conversion.title.toLowerCase(),
      "audio converter",
      "free converter",
      "online audio tool",
      "browser-based conversion",
      "private audio converter",
      conversion.outputFormat,
    ],
    openGraph: {
      title: `Free ${conversion.title} - HumanLogs`,
      description: conversion.description,
      url: `https://humanlogs.app/tools/${resolvedParams["from-to"]}`,
      siteName: "humanlogs.app",
      images: [
        {
          url: "/landing/og-image.png",
          width: 1200,
          height: 630,
          alt: `HumanLogs - ${conversion.title}`,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Free ${conversion.title} - HumanLogs`,
      description: conversion.description,
      images: ["/landing/og-image.png"],
    },
  };
}

export default async function ConversionPage({ params }: ConversionPageProps) {
  const t = await getTranslations("freetools");
  const resolvedParams = await params;
  const fromTo = resolvedParams["from-to"];

  const conversion = parseConversionType(fromTo);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <section className="container mx-auto px-4 py-24 md:px-6">
        <Link
          href="/tools"
          className="inline-flex items-center text-blue-600 hover:underline mb-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("backToTools")}
        </Link>

        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-black md:text-5xl mb-4">
            {conversion.title}
          </h1>
          <p className="text-lg text-gray-600 md:text-xl">
            {conversion.description}
          </p>
        </div>

        <AudioConverter
          initialConversionType={conversion.type as any}
          initialOutputFormat={conversion.outputFormat}
        />

        {/* SEO Content */}
        <div className="max-w-4xl mx-auto mt-16 prose prose-lg">
          <h2>How to Use This Tool</h2>
          <p>
            Our {conversion.title.toLowerCase()} is completely free and runs
            entirely in your browser. Simply upload your file, select your
            desired output format, and click convert. Your files never leave
            your device - all processing happens locally using WebAssembly
            technology.
          </p>

          <h3>Why Convert Audio Formats?</h3>
          <p>
            Different audio formats serve different purposes. MP3 offers
            excellent compression for everyday use, WAV provides lossless
            quality for professional work, FLAC combines quality with smaller
            file sizes, and formats like OGG and AAC offer good compression with
            modern codec technology.
          </p>

          <h3>Privacy & Security</h3>
          <p>
            Unlike other online converters that upload your files to remote
            servers, our tool processes everything in your browser. Your audio
            files, videos, and converted outputs never leave your device. No
            accounts, no tracking, no data collection - just pure, private
            conversion.
          </p>
        </div>
      </section>
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: ConversionPageProps) {
  const resolvedParams = await params;
  const fromTo = resolvedParams["from-to"];
  const conversion = parseConversionType(fromTo);

  return {
    title: `${conversion.title} - Free Online Tool`,
    description: conversion.description,
  };
}
