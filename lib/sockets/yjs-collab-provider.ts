import type { Socket } from "socket.io-client";
import * as Y from "yjs";
import {
  type Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";

/**
 * Pluggable transport codec. Stage 2 uses the identity/base64 codec (plaintext);
 * Stage 3 swaps in an AES-GCM codec keyed by the transcription master key so the
 * server only ever relays ciphertext (`enc: true`).
 */
export type YjsCodec = {
  /** Whether payloads are encrypted (surfaced as `enc` on the wire for the E2E proof). */
  enc: boolean;
  encode: (bytes: Uint8Array) => string;
  decode: (payload: string) => Uint8Array;
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

/** Plaintext transport (no E2E) — the default until a master key is resolved. */
export const plaintextCodec: YjsCodec = {
  enc: false,
  encode: bytesToBase64,
  decode: base64ToBytes,
};

type SyncMsg = {
  transcriptionId: string;
  t: "sync" | "awareness";
  enc: boolean;
  d: string;
};

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

  constructor(
    private readonly socket: Socket,
    private readonly transcriptionId: string,
    private readonly doc: Y.Doc,
    private readonly codec: YjsCodec,
    private readonly opts: {
      onSeed: () => void;
      /** Called whenever the save-leader role changes (isSaver). */
      onRole?: (isSaver: boolean) => void;
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
      this.emitMsg("sync", update);
    };
    doc.on("update", this.onDocUpdate);

    // Remote doc / awareness messages -> apply with origin=this.
    this.handleMsg = (data) => {
      if (data.transcriptionId !== this.transcriptionId) return;
      if (data.t === "sync") {
        this.log("recv sync", data.d.length, "b");
        Y.applyUpdate(this.doc, this.codec.decode(data.d), this);
      } else if (data.t === "awareness" && awareness) {
        applyAwarenessUpdate(awareness, this.codec.decode(data.d), this);
      }
    };
    socket.on("yjs:msg", this.handleMsg);

    // Local awareness (cursor) changes -> broadcast.
    if (awareness) {
      this.onAwarenessUpdate = ({ added, updated, removed }, origin) => {
        if (origin === this) return; // came from a remote apply — don't echo
        const changed = [...added, ...updated, ...removed];
        this.emitMsg("awareness", encodeAwarenessUpdate(awareness, changed));
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
        this.setSaver(true); // seed authority == save leader
      } else {
        this.setSaver(false);
        socket.emit("yjs:state-request", {
          transcriptionId: this.transcriptionId,
        });
      }
    };
    socket.on("yjs:role", this.handleRole);

    // We are the authority: answer a late joiner's state request with full state.
    this.handleStateRequest = (data) => {
      if (data.transcriptionId !== this.transcriptionId) return;
      this.log("serving state to", data.requester);
      const full = Y.encodeStateAsUpdate(this.doc);
      socket.emit("yjs:state", {
        transcriptionId: this.transcriptionId,
        requester: data.requester,
        enc: this.codec.enc,
        d: this.codec.encode(full),
      });
    };
    socket.on("yjs:state-request", this.handleStateRequest);

    // We asked for state: apply the authority's full state.
    this.handleState = (data) => {
      if (data.transcriptionId !== this.transcriptionId) return;
      this.log("recv full state", data.d.length, "b");
      Y.applyUpdate(this.doc, this.codec.decode(data.d), this);
      this.synced = true;
    };
    socket.on("yjs:state", this.handleState);

    // (Re)join the blind-relay room on every (re)connection — Socket.io does not
    // replay emits across reconnects, and the server sees a fresh socket that never
    // joined. Rejoining is idempotent (Yjs merges any re-synced state).
    this.handleConnect = () => {
      this.log("(re)connect → join", transcriptionId);
      socket.emit("yjs:join", { transcriptionId });
      this.broadcastLocalAwareness();
    };
    socket.on("connect", this.handleConnect);
    // If already connected, join now (handleConnect only fires on future connects).
    if (socket.connected) {
      this.log("join", transcriptionId, "(already connected)");
      socket.emit("yjs:join", { transcriptionId });
      this.broadcastLocalAwareness();
    }
  }

  /** Push our local awareness state so (re)joined peers see our cursor. */
  private broadcastLocalAwareness() {
    const awareness = this.opts.awareness;
    if (!awareness) return;
    this.emitMsg(
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

  private emitMsg(t: "sync" | "awareness", bytes: Uint8Array) {
    this.log("send yjs:msg", t, bytes.length, "b");
    this.socket.emit("yjs:msg", {
      transcriptionId: this.transcriptionId,
      t,
      enc: this.codec.enc,
      d: this.codec.encode(bytes),
    } satisfies SyncMsg);
  }

  destroy() {
    this.doc.off("update", this.onDocUpdate);
    this.socket.off("yjs:msg", this.handleMsg);
    this.socket.off("yjs:role", this.handleRole);
    this.socket.off("yjs:state-request", this.handleStateRequest);
    this.socket.off("yjs:state", this.handleState);
    this.socket.off("connect", this.handleConnect);
    const awareness = this.opts.awareness;
    if (awareness && this.onAwarenessUpdate) {
      awareness.off("update", this.onAwarenessUpdate);
      // Tell peers to drop our cursor.
      const clientId = awareness.doc.clientID;
      this.emitMsg("awareness", encodeAwarenessUpdate(awareness, [clientId]));
      removeAwarenessStates(awareness, [clientId], this);
    }
    this.socket.emit("yjs:leave", { transcriptionId: this.transcriptionId });
  }
}
