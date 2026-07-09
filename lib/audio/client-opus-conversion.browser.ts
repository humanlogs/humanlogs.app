/**
 * Browser-side conversion of an uploaded audio/video file to standardized opus,
 * BEFORE upload. This offloads the compression work (and its memory cost) from
 * the server to the user's machine, and shrinks the upload from hundreds of MB
 * to a few MB.
 *
 * Memory strategy: the source file is mounted into ffmpeg.wasm via WORKERFS
 * instead of being written into the WASM heap. WORKERFS reads the File lazily
 * from disk, so a 300MB source never has to be held in memory at once — only
 * ffmpeg's small working set plus the (small) opus output live in the heap.
 *
 * This is best-effort: callers must fall back to uploading the raw file (and
 * letting the server convert) whenever `canConvertToOpusInBrowser` returns not
 * ok, or `convertFileToOpus` throws.
 */

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { loadFFmpeg } from "./audio-conversion.browser";

export interface ConvertCapability {
  ok: boolean;
  /** Machine-readable reason when not ok (for logging/telemetry). */
  reason?: string;
}

/**
 * Decide whether we should attempt client-side opus conversion for this file.
 * Conservative on purpose: if the environment looks incompatible or too weak,
 * we return `ok: false` so the caller uploads the raw file and the server
 * handles conversion.
 */
export function canConvertToOpusInBrowser(file: File): ConvertCapability {
  if (typeof window === "undefined") return { ok: false, reason: "not-browser" };
  if (typeof WebAssembly === "undefined") return { ok: false, reason: "no-wasm" };
  if (typeof Worker === "undefined") return { ok: false, reason: "no-worker" };

  // `deviceMemory` (GB) is only exposed by Chromium. When present and low, the
  // device is likely too weak to run ffmpeg.wasm comfortably — delegate to the
  // server. When absent (Firefox/Safari) we optimistically try and rely on the
  // caller's try/catch fallback if it fails.
  const deviceMemory = (
    navigator as Navigator & { deviceMemory?: number }
  ).deviceMemory;
  if (typeof deviceMemory === "number" && deviceMemory < 4) {
    return { ok: false, reason: "low-memory" };
  }

  // An already-opus file gains nothing from a client re-encode; let it go raw
  // (the server normalizes it cheaply).
  const isOpus = file.type === "audio/opus" || /\.opus$/i.test(file.name);
  if (isOpus) return { ok: false, reason: "already-opus" };

  return { ok: true };
}

/**
 * Convert a file to standardized opus in the browser and return a new `File`.
 * The encoding parameters mirror the server (`-c:a libopus -b:a 32k -vn`) so
 * the stored/transcribed artifact is identical regardless of which path ran.
 *
 * @param file - source audio or video file
 * @param onProgress - optional callback receiving a 0..1 completion ratio
 */
export async function convertFileToOpus(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<File> {
  const ffmpeg: FFmpeg = await loadFFmpeg();
  // Dynamically import the enum so the ffmpeg module stays lazily loaded and is
  // never pulled into the initial bundle.
  const { FFFSType } = await import("@ffmpeg/ffmpeg");

  // Unique names so concurrent/repeat conversions never collide in the VFS.
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const mountDir = `/mnt-${stamp}`;
  const outputName = `out-${stamp}.opus`;

  let progressHandler: ((e: { progress: number }) => void) | undefined;

  await ffmpeg.createDir(mountDir);
  try {
    if (onProgress) {
      progressHandler = ({ progress }) => {
        onProgress(Math.min(1, Math.max(0, progress)));
      };
      ffmpeg.on("progress", progressHandler);
    }

    // Mount the File (bytes read lazily from disk, not copied into the heap).
    await ffmpeg.mount(FFFSType.WORKERFS, { files: [file] }, mountDir);
    const inputPath = `${mountDir}/${file.name}`;

    // Same target as the server: opus @ 32k, drop any video stream.
    await ffmpeg.exec([
      "-i",
      inputPath,
      "-vn",
      "-c:a",
      "libopus",
      "-b:a",
      "32k",
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    const bytes =
      typeof data === "string" ? new TextEncoder().encode(data) : data;

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return new File([bytes as BlobPart], `${baseName}.opus`, {
      type: "audio/opus",
    });
  } finally {
    if (progressHandler) ffmpeg.off("progress", progressHandler);
    // Best-effort VFS cleanup; ignore errors so a cleanup failure never masks
    // a real result or error.
    await ffmpeg.unmount(mountDir).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
    await ffmpeg.deleteDir(mountDir).catch(() => {});
  }
}
