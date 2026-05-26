import { getConfig } from "@/lib/config";
import { getStorage } from "@/lib/storage";
import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Readable } from "stream";
import { finished } from "stream/promises";

/**
 * Download encrypted audio file for Gladia transcription
 *
 * This endpoint serves encrypted audio files that have been uploaded to S3
 * for Gladia transcription. The file is decrypted on-the-fly and served once,
 * then immediately deleted from storage.
 *
 * Security:
 * - JWT token contains encryption key and expires in 5 minutes
 * - File is deleted after first download
 * - Old files are cleaned up periodically
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Verify JWT token
    const config = getConfig();
    const secret = new TextEncoder().encode(
      config.auth.sessionSecret || "fallback-secret",
    );

    let payload;
    try {
      const { payload: verifiedPayload } = await jwtVerify(token, secret);
      payload = verifiedPayload;
    } catch (error) {
      console.error("Invalid JWT token:", error);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const {
      s3Key,
      encryptionKey: keyHex,
      iv: ivHex,
      fileName,
    } = payload as any;

    if (!s3Key || !keyHex || !ivHex || !fileName) {
      return NextResponse.json(
        { error: "Invalid token payload" },
        { status: 400 },
      );
    }

    const storage = getStorage();

    // Check if file exists
    if (!(await storage.exists(s3Key))) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Download encrypted file from storage as stream and decrypt on-the-fly
    const encryptedStream = await storage.getFileStream(s3Key);
    const key = Buffer.from(keyHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decryptedStream = (encryptedStream as Readable).pipe(decipher);

    // Delete the source file after the stream completes (success or error)
    void finished(decryptedStream).finally(async () => {
      try {
        await storage.delete(s3Key);
      } catch (deleteError) {
        console.error("Failed to delete streamed audio file:", deleteError);
      }
    });

    // Determine content type based on file extension
    const contentType = "application/octet-stream";

    // Return the decrypted file stream
    return new Response(
      Readable.toWeb(decryptedStream) as ReadableStream<Uint8Array>,
      {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="audio.opus"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Error downloading audio file:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
