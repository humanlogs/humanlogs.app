import { beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  aesCodec,
  plaintextCodec,
} from "@/lib/sockets/yjs-collab-provider";
import { serverEncryption } from "@/lib/encryption/encryption-entities";

/**
 * The blind-relay server never decodes what it forwards. For an E2E-encrypted
 * transcription the provider's codec is the ONLY thing standing between the
 * transcript and the server, so its round-trip has to be exact for arbitrary
 * binary Yjs updates (which contain non-UTF-8 byte sequences).
 *
 * (These replace the former `collab/encrypt.proto.ts` verification script.)
 */

// `aesCodec` uses the browser crypto implementation (Web Crypto + atob/btoa).
// Node 20+ provides both globally, so it runs here unchanged — which is exactly
// what we want to test: the code path the browser really takes.
beforeAll(() => {
  expect(globalThis.crypto?.subtle).toBeDefined();
});

function sampleDoc() {
  const doc = new Y.Doc();
  doc.getMap("speakers").set("speaker_0", "Alice éàü 🎙");
  const frag = doc.getXmlFragment("default");
  const p = new Y.XmlElement("paragraph");
  p.setAttribute("speakerId", "speaker_0");
  p.insert(0, [new Y.XmlText("Bonjour le monde")]);
  frag.insert(0, [p]);
  return doc;
}

describe("plaintextCodec", () => {
  it("round-trips a Yjs update byte-for-byte", async () => {
    const update = Y.encodeStateAsUpdate(sampleDoc());
    const back = await plaintextCodec.decode(await plaintextCodec.encode(update));
    expect(Array.from(back)).toEqual(Array.from(update));
  });

  it("reports itself as unencrypted (the `enc` flag on the wire)", () => {
    expect(plaintextCodec.enc).toBe(false);
  });

  it("handles a large update without blowing the call stack", async () => {
    // Encoding chunks through String.fromCharCode(...) — a naive implementation
    // throws "Maximum call stack size exceeded" on long transcripts.
    const doc = new Y.Doc();
    const text = doc.getText("t");
    text.insert(0, "mot ".repeat(200_000));
    const update = Y.encodeStateAsUpdate(doc);
    expect(update.length).toBeGreaterThan(500_000);
    const back = await plaintextCodec.decode(await plaintextCodec.encode(update));
    expect(back.length).toBe(update.length);
  });
});

describe("aesCodec (E2E transcriptions)", () => {
  const key = () => serverEncryption!.generateAESKeySync();

  it("produces ciphertext that is not the plaintext payload", async () => {
    const codec = aesCodec(key());
    const update = Y.encodeStateAsUpdate(sampleDoc());
    const wire = await codec.encode(update);
    const plain = await plaintextCodec.encode(update);
    expect(wire).not.toBe(plain);
    expect(codec.enc).toBe(true);
  });

  it("round-trips a full document through encrypt → decrypt", async () => {
    const codec = aesCodec(key());
    const source = sampleDoc();
    const wire = await codec.encode(Y.encodeStateAsUpdate(source));

    const target = new Y.Doc();
    Y.applyUpdate(target, await codec.decode(wire));

    expect(target.getMap("speakers").get("speaker_0")).toBe("Alice éàü 🎙");
    expect(target.getXmlFragment("default").length).toBe(1);
    expect(target.getXmlFragment("default").toString()).toContain(
      "Bonjour le monde",
    );
  });

  it("round-trips incremental updates (the steady-state editing path)", async () => {
    const codec = aesCodec(key());
    const source = sampleDoc();
    const target = new Y.Doc();
    Y.applyUpdate(target, await codec.decode(await codec.encode(Y.encodeStateAsUpdate(source))));

    const sv = Y.encodeStateVector(target);
    source.getMap("speakers").set("speaker_1", "Bob");
    const incremental = Y.encodeStateAsUpdate(source, sv);
    Y.applyUpdate(target, await codec.decode(await codec.encode(incremental)));

    expect(target.getMap("speakers").get("speaker_1")).toBe("Bob");
  });

  it("rejects a payload encrypted with a different key (GCM authenticity)", async () => {
    const wire = await aesCodec(key()).encode(Y.encodeStateAsUpdate(sampleDoc()));
    await expect(aesCodec(key()).decode(wire)).rejects.toThrow();
  });

  it("rejects a tampered payload", async () => {
    const k = key();
    const wire = await aesCodec(k).encode(Y.encodeStateAsUpdate(sampleDoc()));
    // Flip a character in the middle of the ciphertext.
    const mid = Math.floor(wire.length / 2);
    const flipped =
      wire.slice(0, mid) + (wire[mid] === "A" ? "B" : "A") + wire.slice(mid + 1);
    await expect(aesCodec(k).decode(flipped)).rejects.toThrow();
  });

  it("uses a fresh IV per message (identical plaintext → different ciphertext)", async () => {
    const codec = aesCodec(key());
    const update = Y.encodeStateAsUpdate(sampleDoc());
    expect(await codec.encode(update)).not.toBe(await codec.encode(update));
  });
});
