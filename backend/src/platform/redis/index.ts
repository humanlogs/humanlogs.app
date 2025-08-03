import config from "config";
import { Context as Context } from "../../types";
import { PlatformService } from "../types";
import RedisClient from "ioredis";

export const isRedisEnabled = () => {
  return config.get<boolean>("redis.use");
};

export const getRedisConfiguration = () => {
  return {
    host: config.get<string>("redis.url").split("://").pop().split(":")[0],
    port: parseInt(config.get<string>("redis.url").split(":").pop()) || 6379,
    tls: config.get<string>("redis.url").includes("amazonaws.com") ? {} : null,
  };
};

export default class Redis implements PlatformService {
  private client: RedisClient;
  private store: any = {};

  async init() {
    if (isRedisEnabled()) {
      this.client = new RedisClient(getRedisConfiguration());
      this.client.on("connect", function () {
        console.log("[redis] Connected!");
      });
      this.client.on("error", function (err) {
        console.log("[redis] Error " + err);
      });
      console.log("[redis] Connecting...");
    }
    return this;
  }

  getClient(): RedisClient | null {
    return this.client;
  }

  async set(context: Context, key: string, value: any) {
    if (!this.client) {
      this.store["data_" + key] = JSON.stringify(value);
      return;
    }
    await this.client.set("data_" + key, JSON.stringify(value));
  }

  async get(context: Context, key: string) {
    if (!this.client) {
      return this.store["data_" + key]
        ? JSON.parse(this.store["data_" + key])
        : null;
    }
    const d = await this.client.get("data_" + key);
    if (!d) return null;
    return JSON.parse(d);
  }
}
