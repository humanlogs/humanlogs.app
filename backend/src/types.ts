import { v4 } from "uuid";
import { TransactionExecutor } from "./platform/db/api";
import { Request } from "express";

export type Context = {
  req_id: string;
  client_id: string;
  id: string;
  role:
    | "USER"
    | "SYSTEM"
    | "NOTHING"
    | "DISABLED"
    | "SYSADMIN"
    | "SYSAGENT"
    | "API";
  created_at: number;
  lang?: string;
  ip?: string;
  db_tnx?: TransactionExecutor;
  trigger_path: string[];
};

export const createContext = (id = "SYSTEM", role = "SYSTEM") => {
  return {
    req_id: v4(),
    client_id: "*",
    id,
    role,
    created_at: new Date().getTime(),
  } as Context;
};

export const withCtx = (req, _res, next) => {
  if ((req?.url?.length || 0) > 2) {
    console.log(`[Express] [${req.method}] ${req.url}`);
  }
  req.ctx = {
    req_id: v4(),
    client_id: "*",
    id: req.user?.id,
    role: "NOTHING",
    created_at: new Date().getTime(),
    lang: req.headers["accept-language"],
    ip: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
    trigger_path: [],
  } as Context;
  return next();
};

export type ValidResponse =
  | {
      error: string;
      message?: string;
      req_id: string;
    }
  | any;

export const ForbiddenError = (message) => {
  return { status: 403, error: "Forbidden", message };
};

export const NotFoundError = (message) => {
  return { status: 404, error: "Entity not found", message };
};

export const UnauthorizedError = (message) => {
  return { status: 401, error: "Unauthorized", message };
};

export const BadRequestError = (message) => {
  return { status: 400, error: "Bad Request", message };
};

export type CtxReq = {
  ctx: Context;
  user: { id: string; email: string };
} & Request;
