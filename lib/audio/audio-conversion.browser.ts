/**
 * Browser-compatible audio conversion utilities using ffmpeg.wasm
 * Lazy loads ffmpeg to avoid bundling 20MB WASM in initial load
 */

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { toast } from "sonner";

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

/**
 * Lazy load ffmpeg.wasm (20MB) only when needed
 * Uses singleton pattern to load once and reuse
 */
async function loadFFmpeg(): Promise<FFmpeg> {
  // Return existing instance if already loaded
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  // Return existing load promise if currently loading
  if (ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }

  // Start loading ffmpeg
  ffmpegLoadPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");

    const ffmpeg = new FFmpeg();

    // Load WASM files from CDN (avoids bundling them)
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

    ffmpeg.on("log", ({ message }) => {
      console.log("[FFmpeg]", message);
    });

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return ffmpegLoadPromise;
}

/**
 * Convert audio blob to MP3 format
 *
 * @param audioBlob - Input audio blob (any format supported by ffmpeg)
 * @param inputFileName - Original file name (for extension detection)
 * @returns MP3 audio blob
 */
export async function convertToMP3(
  audioBlob: Blob,
  inputFileName: string = "audio.opus",
): Promise<Blob> {
  try {
    // Show loading toast
    const loadingToast = toast.loading("Loading audio converter...");

    // Lazy load ffmpeg
    const ffmpeg = await loadFFmpeg();

    toast.dismiss(loadingToast);
    toast.loading("Converting to MP3...");

    // Write input file to ffmpeg's virtual file system
    const inputData = new Uint8Array(await audioBlob.arrayBuffer());
    await ffmpeg.writeFile(inputFileName, inputData);

    // Convert to MP3 with good quality settings
    // -q:a 2 = high quality VBR (0 is best, 9 is worst)
    // -ar 44100 = 44.1kHz sample rate
    await ffmpeg.exec([
      "-i",
      inputFileName,
      "-q:a",
      "2",
      "-ar",
      "44100",
      "output.mp3",
    ]);

    // Read the output file
    const data = await ffmpeg.readFile("output.mp3");
    const mp3Blob = new Blob([new Uint8Array(data as Uint8Array)], {
      type: "audio/mpeg",
    });

    // Clean up virtual file system
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile("output.mp3");

    toast.dismiss();
    return mp3Blob;
  } catch (error) {
    toast.dismiss();
    console.error("Audio conversion error:", error);
    throw new Error("Failed to convert audio to MP3");
  }
}

/**
 * Convert audio/video file to specified format
 * Supports: mp3, wav, m4a, ogg, flac, aac
 *
 * @param file - Input file (audio or video)
 * @param outputFormat - Target audio format
 * @returns Converted audio blob
 */
export async function convertAudioFormat(
  file: File | Blob,
  outputFormat: string,
): Promise<Blob> {
  try {
    // Show loading toast
    const loadingToast = toast.loading("Loading audio converter...");

    // Lazy load ffmpeg
    const ffmpeg = await loadFFmpeg();

    toast.dismiss(loadingToast);
    toast.loading(`Converting to ${outputFormat.toUpperCase()}...`);

    // Determine input extension
    let inputExt = "input";
    if (file instanceof File) {
      const extension = file.name.split(".").pop();
      inputExt = extension || "input";
    }
    const inputFileName = `input.${inputExt}`;
    const outputFileName = `output.${outputFormat}`;

    // Write input file to ffmpeg's virtual file system
    const inputData = new Uint8Array(await file.arrayBuffer());
    await ffmpeg.writeFile(inputFileName, inputData);

    // Configure conversion based on output format
    const conversionArgs = getConversionArgs(outputFormat);

    // Execute conversion
    await ffmpeg.exec(["-i", inputFileName, ...conversionArgs, outputFileName]);

    // Read the output file
    const data = await ffmpeg.readFile(outputFileName);
    const outputBlob = new Blob([new Uint8Array(data as Uint8Array)], {
      type: getMimeType(outputFormat),
    });

    // Clean up virtual file system
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    toast.dismiss();
    return outputBlob;
  } catch (error) {
    toast.dismiss();
    console.error("Audio conversion error:", error);
    throw new Error(`Failed to convert audio to ${outputFormat}`);
  }
}

/**
 * Get ffmpeg conversion arguments for different formats
 */
function getConversionArgs(format: string): string[] {
  switch (format.toLowerCase()) {
    case "mp3":
      return ["-q:a", "2", "-ar", "44100"]; // High quality VBR
    case "wav":
      return ["-ar", "44100", "-ac", "2"]; // 44.1kHz, stereo
    case "m4a":
      return ["-c:a", "aac", "-b:a", "192k"]; // AAC codec, 192kbps
    case "ogg":
      return ["-c:a", "libvorbis", "-q:a", "6"]; // Vorbis codec, quality 6
    case "flac":
      return ["-c:a", "flac", "-compression_level", "5"]; // Lossless
    case "aac":
      return ["-c:a", "aac", "-b:a", "192k"]; // 192kbps
    default:
      return ["-q:a", "2"]; // Default to high quality
  }
}

/**
 * Get MIME type for audio format
 */
function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    flac: "audio/flac",
    aac: "audio/aac",
  };
  return mimeTypes[format.toLowerCase()] || "audio/mpeg";
}

/**
 * Download audio blob as MP3 file
 *
 * @param audioBlob - Input audio blob
 * @param fileName - Desired file name (without extension)
 * @param inputFormat - Original audio format (default: opus)
 */
export async function downloadAsMP3(
  audioBlob: Blob,
  fileName: string,
  inputFormat: string = "opus",
): Promise<void> {
  try {
    // Convert to MP3
    const mp3Blob = await convertToMP3(audioBlob, `input.${inputFormat}`);

    // Download the MP3
    const url = URL.createObjectURL(mp3Blob);
    const link = document.createElement("a");
    link.href = url;
    // Remove existing extension and add .mp3
    const baseFileName = fileName.replace(/\.[^/.]+$/, "");
    link.download = `${baseFileName}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("MP3 downloaded successfully");
  } catch (error) {
    toast.error("Failed to convert and download MP3");
    throw error;
  }
}
