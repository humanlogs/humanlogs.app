import * as Sentry from "@sentry/node";
import { CronJob } from "cron";
import { default as Framework, default as platform } from "..";
import { Context, createContext } from "../../types";
import { id } from "../db/utils";

const jobs: {
  [name: string]: CronJob;
} = {};

const CronService = {
  schedule: (
    name: string,
    cronExpression: string,
    callback: (ctx: Context) => Promise<void>,
    useLock = true
  ) => {
    let CronJobWithCheckIn = CronJob;

    jobs[name] = new CronJobWithCheckIn(
      cronExpression,
      async () => {
        const ctx = {
          ...createContext("cron", "SYSTEM"),
          client_id: "",
          req_id: id(),
        } as Context;
        platform.LoggerDb.get("CronService").info(
          ctx,
          `Run cron job '${name}'`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 1000)
        );

        const lockId = useLock
          ? await platform.Lock.acquire(ctx, "cron-" + name, 60 * 1000)
          : "";
        let extendTimeout: NodeJS.Timeout;

        try {
          if (!lockId && useLock) {
            platform.LoggerDb.get("CronService").info(
              ctx,
              `(Run cron job '${name}' on other instance)`
            );
            return;
          }

          platform.LoggerDb.get("CronService").info(
            ctx,
            `Run cron job '${name}'`
          );

          if (useLock) {
            extendTimeout = setInterval(async () => {
              if (!(await platform.Lock.extend(ctx, lockId, 60 * 1000))) {
                Sentry.captureException(
                  new Error(`Failed to extend lock for cron job '${name}'`)
                );
              }
            }, 30 * 1000);
          }

          const checkInId = Sentry.captureCheckIn({
            monitorSlug: name,
            status: "in_progress",
          });

          try {
            await callback(ctx);
            Sentry.captureCheckIn({
              checkInId,
              monitorSlug: name,
              status: "ok",
            });
          } catch (e) {
            Sentry.captureCheckIn({
              checkInId,
              monitorSlug: name,
              status: "error",
            });
            Sentry.captureException(e, {
              extra: {
                cronJob: name,
              },
            });
            platform.LoggerDb.get("CronService").error(
              ctx,
              `Error with cron job '${name}': ${e}`,
              e
            );
            platform.LoggerDb.flush();
          }
        } catch (e) {
          platform.LoggerDb.get("CronService").error(
            ctx,
            `Error with cron job setup for '${name}': ${e}`,
            e
          );
          await platform.LoggerDb.flush();
          Sentry.captureException(e);
        }

        //Make sure the lock is maintained few seconds in cas operation was too fast
        if (useLock) {
          clearInterval(extendTimeout);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await platform.Lock.release(ctx, lockId);
        }
      },
      null,
      true,
      "UTC"
    );
  },
};

export default CronService;
