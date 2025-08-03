import { createAdapter } from "@socket.io/redis-adapter";
import config from "config";
import http from "http";
import https from "https";
import RedisClient from "ioredis";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import Framework from "..";
import { Context, createContext } from "../../types";
import { Logger } from "../logger-db";
import { PlatformService } from "../types";
import { getRedisConfiguration, isRedisEnabled } from "../redis";

export default class Socket implements PlatformService {
  private logger: Logger;
  private io: Server;
  private redisClient: RedisClient;

  async init() {
    this.logger = Framework.LoggerDb.get("socket");
    if (isRedisEnabled()) {
      this.redisClient = new RedisClient(getRedisConfiguration());
    }
    return this;
  }

  async stop() {
    if (this.io) this.io.close();
  }

  async create(server: http.Server | https.Server) {
    this.io = new Server(server, {
      ...(config.get<boolean>("server.allow_cors") === true
        ? {
            cors: {
              origin: (requestOrigin, callback) =>
                callback(null, requestOrigin),
              methods: ["GET", "POST"],
              credentials: true,
            },
          }
        : {}),
    });

    if (config.get<boolean>("redis.use") && this.redisClient) {
      const pubClient = this.redisClient;
      const subClient = pubClient.duplicate();
      console.log("socket redis connected, starting adapter");
      this.io.adapter(createAdapter(pubClient, subClient));
    }

    const jwtSecret = config.get<string>("jwt.secret");

    this.io.of("websockets").on("connection", (socket) => {
      jwt.verify(
        socket?.handshake?.auth?.token || "",
        jwtSecret,
        (err, decoded: { id: string }) => {
          if (err) {
            this.logger.info(null, "invalid token", err.message);
            socket.disconnect();
            return;
          }

          const userId = decoded.id;
          this.logger.info(null, `user ${userId} connected`);

          socket.join("private/" + userId);
          socket.emit("join:success", { room: "private/" + userId });

          socket.on("join", (event) => {
            if (event.room) {
              const room = event.room.split("client/").pop();
              socket.join("client/" + room);
              socket.emit("join:success", { room: "client/" + room });
            }
          });
        }
      );
    });
  }

  async publish(context: Context, room: string, data: any) {
    this.logger.info(context, room, data);
    if (this.io) {
      this.io
        .of("websockets")
        .to(room)
        .emit("message", { room: room, ...data });
    }
  }

  async publishPrivate(
    _: Context,
    userId: string,
    type: string,
    data: any,
    options?: { delay: number }
  ) {
    setTimeout(() => {
      this.publish(
        {
          ...createContext(userId, "SYSTEM"),
          id: userId,
          ip: "",
          role: "SYSTEM",
          req_id: "",
        },
        `private/${userId}`,
        { event: type, data }
      );
    }, options?.delay || 1);
  }
}
