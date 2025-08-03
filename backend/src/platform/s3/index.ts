import { PutObjectAclCommand, S3 } from "@aws-sdk/client-s3";
import config from "config";
import { PlatformService } from "../types";
import fs from "fs";

export default class S3Service implements PlatformService {
  private bucket: string;
  private s3: S3;

  async init() {
    if (config.get<boolean>("s3.use")) {
      this.s3 = new S3({
        region: config.get<string>("aws.region"),
        credentials: {
          accessKeyId: config.get<string>("aws.id"),
          secretAccessKey: config.get<string>("aws.secret"),
        },
      });
      this.bucket = config.get<string>("s3.bucket");
    }

    return this;
  }

  async upload(key: string, data: string | Buffer) {
    if (data === undefined || data === null) {
      return;
    }
    if (config.get<boolean>("s3.use")) {
      await this.s3.putObject({
        Bucket: this.bucket,
        Key: key.replace(/\/+/, "/").replace(/^\//, ""),
        Body: data,
      });
    } else {
      const localPath = config.get<string>("s3.local_path");
      const fullPath =
        localPath.replace(/\/$/, "") +
        "/" +
        key.replace(/\.\./gm, "").replace(/^\//, "");
      fs.mkdirSync(fullPath.split("/").slice(0, -1).join("/"), {
        recursive: true,
      });
      fs.writeFileSync(fullPath, data);
    }
  }

  async permanentlyDelete(key: string) {
    if (config.get<boolean>("s3.use")) {
      await this.s3.deleteObject({
        Bucket: this.bucket,
        Key: key.replace(/\/+/, "/").replace(/^\//, ""),
      });
    } else {
      const localPath = config.get<string>("s3.local_path");
      const fullPath =
        localPath.replace(/\/$/, "") +
        "/" +
        key.replace(/\.\./gm, "").replace(/^\//, "");
      fs.unlinkSync(fullPath);
    }
  }

  async download(key: string): Promise<ArrayBufferLike | Uint8Array> {
    if (config.get<boolean>("s3.use")) {
      return (
        await (
          await this.s3.getObject({
            Bucket: this.bucket,
            Key: key.replace(/\/+/, "/").replace(/^\//, ""),
          })
        ).Body.transformToByteArray()
      ).buffer;
    } else {
      const localPath = config.get<string>("s3.local_path");
      const fullPath =
        localPath.replace(/\/$/, "") +
        "/" +
        key.replace(/\.\./gm, "").replace(/^\//, "");
      return fs.readFileSync(fullPath);
    }
  }

  async getPublicUrl(key: string): Promise<string> {
    if (config.get<boolean>("s3.use")) {
      await this.s3.send(
        new PutObjectAclCommand({
          Bucket: this.bucket,
          Key: key.replace(/\/+/, "/").replace(/^\//, ""),
          ACL: "public-read",
        })
      );

      const domain =
        config.get<string>("s3.domain") || `${this.bucket}.s3.amazonaws.com`;
      return `https://${domain}/${key.replace(/\/+/, "/").replace(/^\//, "")}`;
    } else {
      return `/api/v1/files/${key.replace(/\/+/, "/").replace(/^\//, "")}`;
    }
  }

  async downloadStream(key: string): Promise<ReadableStream | fs.ReadStream> {
    if (config.get<boolean>("s3.use")) {
      return (
        await this.s3.getObject({
          Bucket: this.bucket,
          Key: key.replace(/\/+/, "/").replace(/^\//, ""),
        })
      ).Body.transformToWebStream();
    } else {
      const localPath = config.get<string>("s3.local_path");
      const fullPath =
        localPath.replace(/\/$/, "") +
        "/" +
        key.replace(/\.\./gm, "").replace(/^\//, "");
      return fs.createReadStream(fullPath);
    }
  }

  async delete(key: string) {
    if (config.get<boolean>("s3.use")) {
      await this.s3.deleteObject({
        Bucket: this.bucket,
        Key: key.replace(/\/+/, "/").replace(/^\//, ""),
      });
    } else {
      const localPath = config.get<string>("s3.local_path");
      const fullPath =
        localPath.replace(/\/$/, "") +
        "/" +
        key.replace(/\.\./gm, "").replace(/^\//, "");
      fs.unlinkSync(fullPath);
    }
  }
}
