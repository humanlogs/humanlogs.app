"use client";

import * as Y from "yjs";
import { Socket } from "socket.io-client";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";

export class YjsSocketIOProvider {
  public doc: Y.Doc;
  public awareness: awarenessProtocol.Awareness;
  private socket: Socket;
  private transcriptionId: string;
  private synced = false;
  private _synced = false;

  constructor(
    socket: Socket,
    transcriptionId: string,
    doc: Y.Doc,
    awareness: awarenessProtocol.Awareness,
  ) {
    this.socket = socket;
    this.transcriptionId = transcriptionId;
    this.doc = doc;
    this.awareness = awareness;

    this._setupListeners();
    this._requestSync();
  }

  private _setupListeners() {
    // Listen for Y.js sync updates from server
    this.socket.on(
      `yjs:sync:${this.transcriptionId}`,
      (update: ArrayBuffer) => {
        console.log("[Y.js] Received sync update:", update.byteLength, "bytes");
        Y.applyUpdate(this.doc, new Uint8Array(update), "socket");
      },
    );

    // Listen for awareness updates from server
    this.socket.on(
      `yjs:awareness:${this.transcriptionId}`,
      (update: ArrayBuffer) => {
        console.log("[Y.js] Received awareness update");
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          new Uint8Array(update),
          "socket",
        );
      },
    );

    // Listen for sync confirmation
    this.socket.on(`yjs:synced:${this.transcriptionId}`, () => {
      this._synced = true;
      this.synced = true;
      console.log("[Y.js] Initial sync completed");
    });

    // Send local document updates to server
    this.doc.on("update", (update: Uint8Array, origin: any) => {
      // Don't send updates that came from the socket
      if (origin !== "socket") {
        console.log(
          "[Y.js] Sending update to server:",
          update.length,
          "bytes",
          "origin:",
          origin,
        );
        this.socket.emit("yjs:update", {
          transcriptionId: this.transcriptionId,
          update: Array.from(update),
        });
      }
    });

    // Send local awareness updates to server
    this.awareness.on("update", ({ added, updated, removed }: any) => {
      const changedClients = added.concat(updated).concat(removed);
      const update = awarenessProtocol.encodeAwarenessUpdate(
        this.awareness,
        changedClients,
      );
      this.socket.emit("yjs:awareness", {
        transcriptionId: this.transcriptionId,
        update: Array.from(update),
      });
    });
  }

  private _requestSync() {
    // Request initial state vector from server
    const stateVector = Y.encodeStateVector(this.doc);
    console.log(
      "[Y.js] Requesting initial sync, state vector:",
      Array.from(stateVector),
    );
    this.socket.emit("yjs:sync-request", {
      transcriptionId: this.transcriptionId,
      stateVector: Array.from(stateVector),
    });
  }

  destroy() {
    // Remove socket listeners
    this.socket.off(`yjs:sync:${this.transcriptionId}`);
    this.socket.off(`yjs:awareness:${this.transcriptionId}`);
    this.socket.off(`yjs:synced:${this.transcriptionId}`);

    // Clear awareness state
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      "disconnect",
    );
  }
}
