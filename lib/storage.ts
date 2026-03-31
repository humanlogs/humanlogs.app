import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getConfig } from "./config";
import fs from "fs/promises";
import path from "path";

export interface StorageAdapter {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  getUrl(key: string, expiresIn?: number): Promise<string>;
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

  async getFileBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.client.send(command);
    const chunks: Uint8Array[] = [];

    if (response.Body) {
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
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
    await fs.mkdir(dir, { recursive: true });
  }

  private getFullPath(key: string): string {
    return path.join(this.basePath, key);
  }

  async upload(key: string, buffer: Buffer): Promise<string> {
    const fullPath = this.getFullPath(key);
    await this.ensureDir(fullPath);
    await fs.writeFile(fullPath, buffer);
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
    return await fs.readFile(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);
    try {
      await fs.unlink(fullPath);
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
      await fs.access(fullPath);
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
