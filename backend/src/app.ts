import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import bodyParser from "body-parser";
import config from "config";
import cookiesParser from "cookie-parser";
import cors from "cors";
import express from "express";
import Framework from "./platform";
import { registerAccountRoutes } from "./services/account";
import { checkAuthenticated } from "./services/account/services/register";
import { initBilling } from "./services/billing";

import http from "http";
import { withCtx } from "./types";

if (process.env.NODE_ENV === "production" && false) {
  Sentry.init({
    dsn: "https://659b778504642be975fc4610fc8d5fc4@o4508291579969536.ingest.de.sentry.io/4509185114701904",
    integrations: [nodeProfilingIntegration()],
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions

    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
  });
}

(async () => {
  const app = express();
  const port = config.get("server.port") || 2999;

  // Endpoints:
  // - login
  // - billing stripe webhook
  // - me
  // - list models
  // - create model
  // - list photos
  // - create photo

  await Framework.init();

  app.use(cors());
  app.use(
    "/api/billing/webhook/stripe",
    express.raw({ type: "application/json" })
  );
  app.use(express.json({ limit: "150mb" }));
  app.use(bodyParser.urlencoded({ extended: true, limit: "150mb" }));
  app.use(cookiesParser());
  app.use(withCtx);

  initBilling(app);
  registerAccountRoutes(app);

  app.get("/", checkAuthenticated, (req, res) => {
    console.log(req);
    res.send({ isAuthenticated: (req as any).isAuthenticated() });
  });

  // The error handler must be registered before any other error middleware and after all controllers
  Sentry.setupExpressErrorHandler(app);

  // Optional fallthrough error handler
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      Sentry.captureException(err);
      console.log(err);
      if (res.headersSent) {
        return next(err);
      }
      if (!err.status) {
        err.status = 500;
      }
      const msg = `${err.status} ${err.message}`;
      console.error(msg);
      res.status(err.status).type("txt").send(msg);
    }
  );

  const server = http.createServer(app);
  Framework.Socket.create(server);

  server.listen(port, () => {
    return console.log(`Express is listening at http://0.0.0.0:${port}`);
  });
})();
