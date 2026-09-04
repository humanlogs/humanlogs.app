import * as Sentry from "@sentry/node";
import { sentryConfig } from "../config";

/**
 * Server-side error reporting.
 *
 * This app handles research interviews under end-to-end encryption, so the
 * question is not "what can we send to Sentry" but "what are we *certain* is
 * safe to send". Three rules follow from that, and they are what most of this
 * file enforces:
 *
 *  1. **Off unless asked for.** No DSN, no client, no network calls. A
 *     self-hosted instance never phones home unless its operator configures it.
 *  2. **Context is allow-listed, not blocked.** `captureError` takes a fixed set
 *     of named fields (ids, provider, sizes, stage) rather than a free-form bag.
 *     A blocklist would eventually miss something; an allowlist cannot.
 *  3. **Nothing derived from user content, ever.** Not transcripts, not speaker
 *     names, not the vocabulary (which is encrypted at rest precisely because it
 *     holds participant names), and not the uploaded filename — research audio
 *     is routinely named after the participant.
 *
 * Only errors are reported. Tracing is off by default: spans carry far more
 * request detail than exceptions do, and none of it is needed to answer "why
 * did this upload fail".
 */

/** Fields that are safe to attach to a report. Deliberately closed. */
export type ErrorContext = {
  /** Which pipeline stage raised this — "compression", "upload", "stt-start"… */
  stage?: string;
  transcriptionId?: string;
  /** Opaque uuid. Never an email or a name. */
  userId?: string;
  sttProvider?: string;
  /** Named cron job or webhook, for background failures. */
  job?: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  httpStatus?: number;
};

/**
 * Strip everything the SDK collects on its own that could carry user content.
 *
 * `sendDefaultPii: false` already keeps out bodies, cookies and IPs, but this
 * runs as the last gate before transport so a future SDK default cannot quietly
 * widen what leaves the process. Exported for tests — it is the one piece here
 * whose failure would be silent and irreversible.
 */
export function scrubEvent<T extends Sentry.Event>(event: T): T {
  // Request data: the multipart body of an upload is the audio itself, and the
  // query string and headers carry session cookies and grant tokens.
  delete event.request;

  // Identify the account, never the person.
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : {};
  }

  // Server name can be an internal hostname; it tells us nothing useful here.
  delete event.server_name;

  return event;
}

let initialized = false;

/**
 * Start Sentry. Safe to call more than once; a no-op without a DSN.
 *
 * Must run before anything that opens sockets or database connections, so the
 * SDK's auto-instrumentation can wrap them — in practice, the first import in
 * `server.ts`.
 */
export function initSentry(): boolean {
  if (initialized) return true;

  const dsn = sentryConfig.dsn?.trim();
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment:
      sentryConfig.environment?.trim() || process.env.NODE_ENV || "development",

    // Never attach request bodies, headers, cookies or IP addresses.
    sendDefaultPii: false,

    // A stack frame's locals can hold a decrypted buffer or a vocabulary array.
    // Off by default in the SDK; pinned here so enabling it stays a decision.
    includeLocalVariables: false,

    tracesSampleRate: sentryConfig.tracesSampleRate,

    integrations: (defaults) =>
      defaults.filter(
        // Console breadcrumbs would capture our own log lines verbatim —
        // several of which include the uploaded filename.
        (integration) => integration.name !== "Console",
      ),

    beforeSend: (event) => scrubEvent(event),

    // Breadcrumbs are unstructured by nature; keep only the ones we cannot
    // avoid and drop anything carrying a payload.
    beforeBreadcrumb: (breadcrumb) => {
      if (breadcrumb.category === "console") return null;
      if (breadcrumb.data) delete breadcrumb.data.body;
      return breadcrumb;
    },
  });

  initialized = true;
  console.log(
    `[SENTRY] Error reporting enabled (environment: ${
      sentryConfig.environment?.trim() || process.env.NODE_ENV
    })`,
  );
  return true;
}

/** Whether reporting is actually running, for callers that want to log a fallback. */
export function isSentryEnabled(): boolean {
  return initialized;
}

/**
 * Report an error with a closed set of context fields.
 *
 * Always call this *in addition to* the existing `console.error`, never instead
 * of it: CloudWatch stays the complete record, Sentry is the alerting and
 * grouping layer on top. A no-op when reporting is disabled, so callers do not
 * have to branch.
 */
export function captureError(error: unknown, context: ErrorContext = {}): void {
  if (!initialized) return;

  try {
    Sentry.withScope((scope) => {
      // Low-cardinality fields become tags so they can be searched and grouped.
      if (context.stage) scope.setTag("stage", context.stage);
      if (context.sttProvider) scope.setTag("stt_provider", context.sttProvider);
      if (context.job) scope.setTag("job", context.job);
      if (typeof context.httpStatus === "number") {
        scope.setTag("http_status", String(context.httpStatus));
      }

      // High-cardinality identifiers and measurements go to context.
      const details: Record<string, string | number> = {};
      if (context.transcriptionId) {
        details.transcriptionId = context.transcriptionId;
      }
      if (typeof context.fileSizeBytes === "number") {
        details.fileSizeBytes = context.fileSizeBytes;
      }
      if (typeof context.durationSeconds === "number") {
        details.durationSeconds = context.durationSeconds;
      }
      if (Object.keys(details).length > 0) {
        scope.setContext("transcription", details);
      }

      if (context.userId) scope.setUser({ id: context.userId });

      Sentry.captureException(error);
    });
  } catch (reportingError) {
    // Reporting must never be the reason a failure path throws — the caller is
    // already handling an error and would lose it.
    console.error("[SENTRY] Failed to report error:", reportingError);
  }
}

/** Flush pending events, for shutdown paths that are about to exit. */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!initialized) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // Losing a report during shutdown is not worth blocking the exit.
  }
}
