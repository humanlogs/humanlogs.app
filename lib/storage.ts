import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getConfig } from "./config";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { Readable } from "stream";

export interface StorageAdapter {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  getUrl(key: string, expiresIn?: number): Promise<string>;
  getFileStream(key: string): Promise<NodeJS.ReadableStream>;
  getFileBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// S3 Storage Adapter
class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    const config = getConfig();
    this.client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    });
    this.bucketName = config.aws.s3.bucketName;
  }

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);
    return `s3://${this.bucketName}/${key}`;
  }

  async getUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  async getFileStream(key: string): Promise<NodeJS.ReadableStream> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`Storage key not found: ${key}`);
    }

    const body = response.Body as unknown;

    if (body instanceof Readable) {
      return body;
    }

    if (
      body &&
      typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] ===
        "function"
    ) {
      return Readable.from(body as AsyncIterable<Uint8Array>);
    }

    throw new Error("Unsupported S3 body stream type");
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const response = await this.getFileStream(key);
    const chunks: Uint8Array[] = [];

    for await (const chunk of response as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }
}

// Local File Storage Adapter
class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor() {
    // Store files in /tmp/transcription-audio for local dev
    this.basePath = path.join(process.cwd(), ".local-storage", "audio");
  }

  private async ensureDir(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fsPromises.mkdir(dir, { recursive: true });
  }

  private getFullPath(key: string): string {
    return path.join(this.basePath, key);
  }

  async upload(key: string, buffer: Buffer): Promise<string> {
    const fullPath = this.getFullPath(key);
    await this.ensureDir(fullPath);
    await fsPromises.writeFile(fullPath, buffer);
    return `local://${key}`;
  }

  async getUrl(key: string): Promise<string> {
    // For local storage, return a data URL or file path
    // In a real app, you'd serve these through an API route
    const fullPath = this.getFullPath(key);
    return `file://${fullPath}`;
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const fullPath = this.getFullPath(key);
    return await fsPromises.readFile(fullPath);
  }

  async getFileStream(key: string): Promise<NodeJS.ReadableStream> {
    const fullPath = this.getFullPath(key);
    return fs.createReadStream(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);
    try {
      await fsPromises.unlink(fullPath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.getFullPath(key);
    try {
      await fsPromises.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

// Factory function to get the appropriate storage adapter
let storageInstance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (storageInstance) {
    return storageInstance;
  }

  try {
    const config = getConfig();
    // Check if S3 is configured
    if (
      config.aws?.region &&
      config.aws?.s3?.bucketName &&
      config.aws?.accessKeyId &&
      config.aws?.secretAccessKey
    ) {
      console.log("Using S3 storage adapter");
      storageInstance = new S3StorageAdapter();
    } else {
      console.log("S3 not configured, using local storage adapter");
      storageInstance = new LocalStorageAdapter();
    }
  } catch {
    console.log("Error loading config, falling back to local storage adapter");
    storageInstance = new LocalStorageAdapter();
  }

  return storageInstance;
}

// Helper to generate storage key for audio files
export function generateAudioKey(
  userId: string,
  transcriptionId: string,
  filename: string,
): string {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${userId}/${transcriptionId}/${sanitizedFilename}`;
}
