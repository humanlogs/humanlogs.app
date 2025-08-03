import config from "config";
import { v4 } from "uuid";
import Framework from "..";
import { Context } from "../../types";
import Redis from "../redis";
import { PlatformService } from "../types";

const useRedis = config.get<string>("redis.use");

const locks: {
  [key: string]: {
    exp: number;
    key: string;
  };
} = {};

export default class Lock implements PlatformService {
  private redis: Redis;

  public async init(redis: Redis) {
    if (useRedis) this.redis = redis;
    return this;
  }

  public async acquire(ctx: Context, key: string, ttl = 5000) {
    const now = Date.now();
    const expiresAt = now + ttl;

    if (await this.isLocked(ctx, key)) {
      return null; // Lock is still active
    }

    const lockId = v4();
    locks[lockId] = { exp: expiresAt, key: key };
    if (useRedis) {
      await this.redis.set(ctx, key, expiresAt.toString()); // Set new expiration time
    }
    return lockId;
  }

  public async isLocked(ctx: Context, key: string) {
    const existingTimestamp = useRedis
      ? await this.redis.get(ctx, key)
      : locks[key]?.exp?.toString();
    if (existingTimestamp && parseInt(existingTimestamp) > Date.now()) {
      return true;
    }
    return false;
  }

  public async extend(ctx: Context, lockId: string, ttl = 5000) {
    const lock = locks[lockId];
    if (!lock || lock.exp < Date.now()) return false;

    const now = Date.now();
    const expiresAt = now + ttl;
    locks[lockId].exp = expiresAt;
    if (useRedis) await this.redis.set(ctx, lock.key, expiresAt.toString());

    return lockId;
  }

  public async release(ctx: Context, lockId: string) {
    const lock = locks[lockId];
    if (!lock || lock.exp < Date.now()) return false;

    if (useRedis) await this.redis.set(ctx, lock.key, "0");
    delete locks[lockId];

    return true;
  }
}
