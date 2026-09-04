import { describe, expect, it } from "vitest";
import type { Event } from "@sentry/node";
import {
  captureError,
  isSentryEnabled,
  scrubEvent,
} from "@/lib/observability/sentry";

/**
 * This app carries research interviews under end-to-end encryption, so a report
 * that leaks payload data is worse than no report at all — and it would leak
 * silently, to a third party, with no way to unsend it.
 *
 * `scrubEvent` is the last gate before transport. These tests pin what it must
 * remove, so that a future SDK upgrade that starts collecting something new by
 * default fails here rather than in production.
 */

describe("scrubEvent", () => {
  it("drops request data entirely", () => {
    // For an upload, the request body IS the audio.
    const event = {
      request: {
        url: "https://humanlogs.app/api/transcriptions/create",
        method: "POST",
        data: "<300MB of interview audio>",
        cookies: { appSession: "secret-session-cookie" },
        headers: { authorization: "Bearer token", cookie: "appSession=..." },
        query_string: "projectId=abc&token=grant",
      },
    } as unknown as Event;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.request).toBeUndefined();
  });

  it("keeps the account id but nothing that identifies the person", () => {
    const event = {
      user: {
        id: "user-uuid",
        email: "participant@university.edu",
        username: "marie.dupont",
        ip_address: "203.0.113.7",
      },
    } as Event;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.user).toEqual({ id: "user-uuid" });
  });

  it("drops the user object when there is no id to keep", () => {
    const event = {
      user: { email: "participant@university.edu" },
    } as Event;

    expect(scrubEvent(event).user).toEqual({});
  });

  it("removes the server hostname", () => {
    const event = { server_name: "ip-10-0-3-14.eu-west-3.compute.internal" } as Event;

    expect(scrubEvent(event).server_name).toBeUndefined();
  });

  it("leaves the parts of a report we actually need", () => {
    const event = {
      exception: {
        values: [{ type: "Error", value: "ffmpeg exited with code 1" }],
      },
      tags: { stage: "audio-processing", stt_provider: "gladia" },
      contexts: { transcription: { transcriptionId: "t-1" } },
      request: { url: "https://humanlogs.app/x" },
    } as unknown as Event;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.exception?.values?.[0]?.value).toBe(
      "ffmpeg exited with code 1",
    );
    expect(scrubbed.tags).toEqual({
      stage: "audio-processing",
      stt_provider: "gladia",
    });
    expect(scrubbed.contexts).toEqual({
      transcription: { transcriptionId: "t-1" },
    });
  });
});

describe("when no DSN is configured", () => {
  it("stays disabled", () => {
    // The test config carries no DSN, which is also the shipped default: a
    // self-hosted instance must not phone home unless asked.
    expect(isSentryEnabled()).toBe(false);
  });

  it("makes captureError a silent no-op rather than throwing", () => {
    // Callers are already inside a catch block; reporting must never be the
    // thing that throws and loses the original error.
    expect(() =>
      captureError(new Error("boom"), {
        stage: "audio-processing",
        transcriptionId: "t-1",
      }),
    ).not.toThrow();
  });
});
