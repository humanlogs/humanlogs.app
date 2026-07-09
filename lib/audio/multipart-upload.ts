/**
 * Streaming multipart/form-data parser for large uploads.
 *
 * Unlike `request.formData()` (which materializes every uploaded file fully in
 * memory), this parser streams each file part directly to a temporary file on
 * disk as the bytes arrive. Only small text fields are kept in memory. This
 * keeps RAM usage flat regardless of file size or the number of files in a
 * single request, which is the whole point of the audio/video upload endpoint.
 */

import busboy from "busboy";
import { Readable } from "stream";
import { createWriteStream } from "fs";
import { unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import crypto from "crypto";

export interface StreamedFile {
  /** Multipart field name, e.g. "file_0". */
  fieldName: string;
  /** Original filename provided by the client. */
  filename: string;
  /** MIME type reported by the client. */
  mimeType: string;
  /** Absolute path to the temp file the bytes were streamed to. */
  tmpPath: string;
  /** Number of bytes written to disk. */
  size: number;
  /** True if the file exceeded `maxFileSize` and was truncated. */
  truncated: boolean;
}

export interface StreamedFormData {
  /** Text fields (small values kept in memory). */
  fields: Record<string, string>;
  /** Files streamed to disk. */
  files: StreamedFile[];
  /** Best-effort removal of every temp file created by this parse. Safe to
   *  call multiple times and after individual files have already been unlinked. */
  cleanup: () => Promise<void>;
}

export interface ParseOptions {
  /** Hard per-file size limit in bytes. Files over this are truncated and flagged. */
  maxFileSize: number;
}

/**
 * Parse a multipart/form-data request, streaming file parts to disk.
 * Rejects if the request is not multipart or if the underlying stream errors.
 */
export async function parseMultipartToDisk(
  request: Request,
  options: ParseOptions,
): Promise<StreamedFormData> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new Error("Expected multipart/form-data request");
  }
  if (!request.body) {
    throw new Error("Request has no body");
  }

  const fields: Record<string, string> = {};
  const files: StreamedFile[] = [];
  const createdPaths: string[] = [];

  const cleanup = async () => {
    await Promise.all(
      createdPaths.map((p) => unlink(p).catch(() => {})),
    );
  };

  return await new Promise<StreamedFormData>((resolve, reject) => {
    const bb = busboy({
      headers: { "content-type": contentType },
      limits: {
        fileSize: options.maxFileSize,
        // Field values are small (language, ids, durations, vocabulary). Keep a
        // generous ceiling so we never silently truncate a legitimate field.
        fieldSize: 10 * 1024 * 1024,
      },
    });

    // Track in-flight disk writes so we only resolve once every byte is flushed.
    const writes: Promise<void>[] = [];
    let aborted = false;

    const fail = (err: Error) => {
      if (aborted) return;
      aborted = true;
      // Remove any partial temp files before surfacing the error.
      cleanup().finally(() => reject(err));
    };

    bb.on("field", (name, val) => {
      fields[name] = val;
    });

    bb.on("file", (name, stream, info) => {
      const randomId = crypto.randomBytes(16).toString("hex");
      const tmpPath = join(tmpdir(), `upload-${randomId}`);
      createdPaths.push(tmpPath);

      const record: StreamedFile = {
        fieldName: name,
        filename: info.filename,
        mimeType: info.mimeType,
        tmpPath,
        size: 0,
        truncated: false,
      };
      files.push(record);

      stream.on("data", (chunk: Buffer) => {
        record.size += chunk.length;
      });
      stream.on("limit", () => {
        record.truncated = true;
      });

      const out = createWriteStream(tmpPath);
      const writePromise = new Promise<void>((res, rej) => {
        out.on("finish", () => res());
        out.on("error", rej);
        stream.on("error", rej);
      });
      writes.push(writePromise);
      stream.pipe(out);
    });

    bb.on("error", (err) => fail(err as Error));

    bb.on("close", () => {
      if (aborted) return;
      Promise.all(writes)
        .then(() => resolve({ fields, files, cleanup }))
        .catch((err) => fail(err as Error));
    });

    const nodeStream = Readable.fromWeb(
      request.body as unknown as import("stream/web").ReadableStream<Uint8Array>,
    );
    nodeStream.on("error", (err) => fail(err));
    nodeStream.pipe(bb);
  });
}
