import type { Socket } from "socket.io-client";
import * as Y from "yjs";
import {
  type Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { EncryptionUtils } from "@/lib/encryption/encryption-entities";
import { browserCrypto } from "@/lib/encryption/encryption-entities.browser";

/**
 * Pluggable transport codec. Non-E2E transcriptions use the plaintext (base64)
 * codec; E2E ones use {@link aesCodec} keyed by the transcription's master key so
 * the blind-relay server only ever sees ciphertext (`enc: true`). Async because Web
 * Crypto is async.
 */
export type YjsCodec = {
  /** Whether payloads are encrypted (surfaced as `enc` on the wire for the E2E proof). */
  enc: boolean;
  encode: (bytes: Uint8Array) => Promise<string>;
  decode: (payload: string) => Promise<Uint8Array>;
};

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Plaintext transport (non-E2E transcriptions) — base64, no encryption. */
export const plaintextCodec: YjsCodec = {
  enc: false,
  encode: async (bytes) => bytesToBase64(bytes),
  decode: async (payload) => base64ToBytes(payload),
};

/**
 * E2E transport codec: AES-256-GCM with the transcription's stable session key
 * (base64). Yjs updates are binary; the underlying primitive is UTF-8-string based,
 * so we base64 the bytes before encrypting and reverse on decrypt. The server relays
 * only the resulting ciphertext.
 */
export function aesCodec(aesKeyBase64: string): YjsCodec {
  const utils = new EncryptionUtils(browserCrypto);
  return {
    enc: true,
    encode: async (bytes) =>
      utils.encryptWithAESKeySync(bytesToBase64(bytes), aesKeyBase64),
    decode: async (payload) =>
      base64ToBytes(await utils.decryptWithAESKeySync(payload, aesKeyBase64)),
  };
}

type SyncMsg = {
  transcriptionId: string;
  t: "sync" | "awareness";
  enc: boolean;
  d: string;
};

/**
 * Identifies a provider INSTANCE (not the socket, which is a shared singleton and
 * outlives it). Sent with join/leave so the server can tell a live client from the
 * goodbye of an instance it already replaced — see `joinSessions` in socket-server.
 */
let sessionCounter = 0;

/** How long to wait for the authority's state before asking again. */
const STATE_RETRY_MS = 4000;
/** Give up re-asking after this many tries (~20s) and let the UI stay as it is. */
const STATE_MAX_ATTEMPTS = 5;

/**
 * Blind-relay Yjs provider over Socket.io. The server never sees a Y.Doc — it
 * relays opaque `yjs:msg` and coordinates a seeding authority. This provider:
 *   - forwards local doc updates as `yjs:msg { t: "sync" }`
 *   - applies remote messages (origin = this provider, so the observer treats them
 *     as remote and re-renders, and our own update handler doesn't echo them back)
 *   - on `yjs:role` "seed" calls `onSeed()`; on "sync" pulls full state from a peer
 */
export class YjsCollabProvider {
  synced = false;
  /**
   * True when this client is the room's seeding authority. Used as the collab
   * "save leader": only this client persists to Postgres, so N writers don't race
   * and corrupt the stored utterances JSON.
   */
  isSaver = false;

  private readonly onDocUpdate: (update: Uint8Array, origin: unknown) => void;
  private readonly handleMsg: (data: SyncMsg) => void;
  private readonly handleRole: (data: {
    transcriptionId: string;
    role: "seed" | "sync";
  }) => void;
  private readonly handleStateRequest: (data: {
    transcriptionId: string;
    requester: string;
  }) => void;
  private readonly handleState: (data: {
    transcriptionId: string;
    enc: boolean;
    d: string;
  }) => void;
  private readonly handleConnect: () => void;

  private readonly onAwarenessUpdate?: (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => void;

  /** This provider instance's identity on the wire (see {@link sessionCounter}). */
  private readonly session = `s${++sessionCounter}-${Math.random().toString(36).slice(2, 8)}`;
  private stateTimer: ReturnType<typeof setTimeout> | null = null;
  private stateAttempts = 0;
  private awaitingState = false;
  private destroyed = false;

  constructor(
    private readonly socket: Socket,
    private readonly transcriptionId: string,
    private readonly doc: Y.Doc,
    private readonly codec: YjsCodec,
    private readonly opts: {
      onSeed: () => void;
      /** Called whenever the save-leader role changes (isSaver). */
      onRole?: (isSaver: boolean) => void;
      /** Called once the full state from a peer has been applied (sync clients). */
      onSynced?: () => void;
      /** Awareness instance to relay (for CollaborationCursor). */
      awareness?: Awareness;
      /** Enable verbose console diagnostics. */
      debug?: boolean;
    },
  ) {
    const awareness = opts.awareness;
    // Local doc changes (not remote applies) -> broadcast.
    this.onDocUpdate = (update, origin) => {
      if (origin === this) return; // came from a remote apply — don't echo
      // The initial seed is huge (whole doc) and never needed by peers over the
      // wire: late joiners pull full state via yjs:state on join. Skip it.
      if (origin === "seed") return;
      void this.emitMsg("sync", update);
    };
    doc.on("update", this.onDocUpdate);

    // Remote doc / awareness messages -> decode (async, E2E) then apply origin=this.
    // Applies can land out of order under async decrypt — fine, Yjs updates converge.
    this.handleMsg = (data) => {
      if (data.transcriptionId !== this.transcriptionId) return;
      if (data.t === "sync") {
        this.log("recv sync", data.d.length, "b");
        void this.codec
          .decode(data.d)
          .then((bytes) => Y.applyUpdate(this.doc, bytes, this))
          .catch((e) => this.log("decode sync failed", e));
      } else if (data.t === "awareness" && awareness) {
        void this.codec
          .decode(data.d)
          .then((bytes) => applyAwarenessUpdate(awareness, bytes, this))
          .catch((e) => this.log("decode awareness failed", e));
      }
    };
    socket.on("yjs:msg", this.handleMsg);

    // Local awareness (cursor) changes -> broadcast.
    if (awareness) {
      this.onAwarenessUpdate = ({ added, updated, removed }, origin) => {
        if (origin === this) return; // came from a remote apply — don't echo
        const changed = [...added, ...updated, ...removed];
        void this.emitMsg("awareness", encodeAwarenessUpdate(awareness, changed));
      };
      awareness.on("update", this.onAwarenessUpdate);
    }

    // Role assignment from the server (also on authority promotion).
    this.handleRole = (data) => {
      if (data.transcriptionId !== this.transcriptionId) return;
      this.log("role:", data.role);
      if (data.role === "seed") {
        this.opts.onSeed();
        this.synced = true;
        this.stateSettled();
        this.setSaver(true); // seed authority == save leader
      } else {
        this.setSaver(false);
        this.requestState();
      }
    };
    socket.on("yjs:role", this.handleRole);

    // We are the authority: answer a late joiner's state request with full state.
    this.handleStateRequest = (data) => {
      if (data.transcriptionId !== this.transcriptionId) return;
      this.log("serving state to", data.requester);
      const full = Y.encodeStateAsUpdate(this.doc);
      void this.codec.encode(full).then((d) =>
        this.socket.emit("yjs:state", {
          transcriptionId: this.transcriptionId,
          requester: data.requester,
          enc: this.codec.enc,
          d,
        }),
      );
    };
    socket.on("yjs:state-request", this.handleStateRequest);

    // We asked for state: apply the authority's full state.
    this.handleState = (data) => {
      if (data.transcriptionId !== this.transcriptionId) return;
      this.log("recv full state", data.d.length, "b");
      void this.codec
        .decode(data.d)
        .then((bytes) => {
          Y.applyUpdate(this.doc, bytes, this);
          this.synced = true;
          this.stateSettled();
          this.opts.onSynced?.();
        })
        .catch((e) => this.log("decode state failed", e));
    };
    socket.on("yjs:state", this.handleState);

    // (Re)join the blind-relay room on every (re)connection — Socket.io does not
    // replay emits across reconnects, and the server sees a fresh socket that never
    // joined. Rejoining is idempotent (Yjs merges any re-synced state).
    this.handleConnect = () => {
      this.log("(re)connect → join", transcriptionId);
      socket.emit("yjs:join", { transcriptionId, session: this.session });
      this.broadcastLocalAwareness();
      // Re-announce everything we hold. A reconnect gives us a fresh server-side
      // session that knows nothing about this client, and anything typed while
      // the socket was down never reached the room — without this, work done
      // offline (a tunnel, a closed laptop lid) would be silently lost to peers.
      // For a first connection the document is still empty, so this is a couple
      // of bytes; Yjs merges the duplicate state on the receiving side.
      void this.emitMsg("sync", Y.encodeStateAsUpdate(this.doc));
    };
    socket.on("connect", this.handleConnect);
    // If already connected, join now (handleConnect only fires on future connects).
    if (socket.connected) {
      this.log("join", transcriptionId, "(already connected)");
      socket.emit("yjs:join", { transcriptionId, session: this.session });
      this.broadcastLocalAwareness();
    }
  }

  /**
   * Ask the authority for the full document, and keep asking.
   *
   * A single request is one packet away from a permanently blank editor: the
   * authority may be a socket the server has not yet noticed leaving, its reply
   * may fail to decode, or our seat in the room may have been lost. Re-joining
   * along the way is what repairs the last case — the server answers a join with
   * a role, and promotes us to seed if nobody else can serve the document.
   */
  private requestState() {
    if (this.destroyed) return;
    this.awaitingState = true;
    this.socket.emit("yjs:state-request", {
      transcriptionId: this.transcriptionId,
    });
    this.clearStateTimer();
    if (this.stateAttempts >= STATE_MAX_ATTEMPTS) return;
    this.stateTimer = setTimeout(() => {
      this.stateTimer = null;
      if (this.destroyed || !this.awaitingState) return;
      this.stateAttempts++;
      this.log(
        "no state after",
        STATE_RETRY_MS,
        "ms — retry",
        this.stateAttempts,
      );
      this.socket.emit("yjs:join", {
        transcriptionId: this.transcriptionId,
        session: this.session,
      });
      this.requestState();
    }, STATE_RETRY_MS);
  }

  /** A state reply landed (or is no longer needed): stop the retry loop. */
  private stateSettled() {
    this.awaitingState = false;
    this.stateAttempts = 0;
    if (this.stateTimer) clearTimeout(this.stateTimer);
    this.stateTimer = null;
  }

  private clearStateTimer() {
    if (this.stateTimer) clearTimeout(this.stateTimer);
    this.stateTimer = null;
  }

  /** Push our local awareness state so (re)joined peers see our cursor. */
  private broadcastLocalAwareness() {
    const awareness = this.opts.awareness;
    if (!awareness) return;
    void this.emitMsg(
      "awareness",
      encodeAwarenessUpdate(awareness, [awareness.doc.clientID]),
    );
  }

  private setSaver(v: boolean) {
    if (this.isSaver === v) return;
    this.isSaver = v;
    this.opts.onRole?.(v);
  }

  private log(...args: unknown[]) {
    if (this.opts.debug) console.log("[collab-provider]", ...args);
  }

  private async emitMsg(t: "sync" | "awareness", bytes: Uint8Array) {
    this.log("send yjs:msg", t, bytes.length, "b");
    const d = await this.codec.encode(bytes);
    this.socket.emit("yjs:msg", {
      transcriptionId: this.transcriptionId,
      t,
      enc: this.codec.enc,
      d,
    } satisfies SyncMsg);
  }

  /**
   * Tear down listeners and tell peers to drop our caret.
   *
   * Returns a promise that resolves once the farewell awareness message has been
   * emitted — callers that also close the socket should await it, otherwise the
   * message (encoded asynchronously by the codec) is dropped with the socket.
   */
  destroy(): Promise<void> {
    this.destroyed = true;
    this.clearStateTimer();
    this.doc.off("update", this.onDocUpdate);
    this.socket.off("yjs:msg", this.handleMsg);
    this.socket.off("yjs:role", this.handleRole);
    this.socket.off("yjs:state-request", this.handleStateRequest);
    this.socket.off("yjs:state", this.handleState);
    this.socket.off("connect", this.handleConnect);
    const awareness = this.opts.awareness;
    let farewell = Promise.resolve();
    if (awareness && this.onAwarenessUpdate) {
      awareness.off("update", this.onAwarenessUpdate);
      // Tell peers to drop our cursor. The state must be REMOVED FIRST: encoding
      // beforehand would re-announce our (still present) cursor instead of its
      // removal, leaving a ghost caret on every peer until y-protocols' 30s
      // outdated-state timeout kicks in. removeAwarenessStates bumps the clock,
      // so the encode below carries a null state peers apply immediately.
      const clientId = awareness.doc.clientID;
      removeAwarenessStates(awareness, [clientId], this);
      farewell = this.emitMsg(
        "awareness",
        encodeAwarenessUpdate(awareness, [clientId]),
      );
    }
    // Leave AFTER the farewell has gone out: the server drops this socket's
    // membership on `yjs:leave`, and would then refuse to relay the very message
    // telling peers to remove our caret.
    return farewell.then(() => {
      this.socket.emit("yjs:leave", {
        transcriptionId: this.transcriptionId,
        session: this.session,
      });
    });
  }
}
