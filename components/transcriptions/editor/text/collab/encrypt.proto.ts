/**
 * E2E transport codec verification (runnable): proves a Yjs binary update survives
 * the base64 → AES-256-GCM → base64 → binary round-trip that aesCodec performs, and
 * that a "reuse the session key" save re-encrypts a payload the same key decrypts.
 *
 *   npx tsx components/transcriptions/editor/text/collab/encrypt.proto.ts
 *
 * Uses the Node crypto instance (serverEncryption) — same EncryptionUtils class /
 * algorithm as the browser codec, so the base64/binary handling is what's tested.
 */
import * as Y from "yjs";
import { serverEncryption } from "@/lib/encryption/encryption-entities";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return Buffer.from(bin, "binary").toString("base64");
}
function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function main() {
  const enc = serverEncryption!;
  const key = enc.generateAESKeySync();

  const encode = async (bytes: Uint8Array) =>
    enc.encryptWithAESKeySync(bytesToBase64(bytes), key);
  const decode = async (payload: string) =>
    base64ToBytes(await enc.decryptWithAESKeySync(payload, key));

  console.log("E2E transport codec:");

  // 1. A non-trivial Yjs update (binary, includes non-UTF-8 byte sequences).
  const doc = new Y.Doc();
  doc.getMap("speakers").set("speaker_0", "Alice éàü");
  const frag = doc.getXmlFragment("default");
  const p = new Y.XmlElement("paragraph");
  p.insert(0, [new Y.XmlText("Bonjour le monde")]);
  frag.insert(0, [p]);
  const update = Y.encodeStateAsUpdate(doc);

  const cipher = await encode(update);
  check("ciphertext differs from plaintext (encrypted)", cipher !== bytesToBase64(update));

  const back = await decode(cipher);
  check("decoded bytes length matches", back.length === update.length);

  const doc2 = new Y.Doc();
  Y.applyUpdate(doc2, back);
  check(
    "Yjs doc round-trips through the codec",
    doc2.getMap("speakers").get("speaker_0") === "Alice éàü" &&
      doc2.getXmlFragment("default").length === 1,
  );

  // 2. Incremental update round-trip.
  const before = Y.encodeStateVector(doc2);
  doc.getMap("speakers").set("speaker_1", "Bob");
  const incremental = Y.encodeStateAsUpdate(doc, before);
  Y.applyUpdate(doc2, await decode(await encode(incremental)));
  check("incremental update applies", doc2.getMap("speakers").get("speaker_1") === "Bob");

  // 3. "Reuse key" save: re-encrypt a payload with the same key and decrypt it back.
  const payload = await enc.encryptWithAESKeySync(
    JSON.stringify({ words: [{ type: "word", text: "hi" }], speakers: [] }),
    key,
  );
  const decrypted = JSON.parse(await enc.decryptWithAESKeySync(payload, key));
  check("reuse-key payload decrypts", decrypted.words[0].text === "hi");

  // 4. Wrong key fails (tamper/authenticity).
  let rejected = false;
  try {
    await enc.decryptWithAESKeySync(cipher, enc.generateAESKeySync());
  } catch {
    rejected = true;
  }
  check("wrong key is rejected (GCM auth)", rejected);

  console.log(
    failures === 0
      ? "\n✅ E2E codec: all checks passed"
      : `\n❌ ${failures} check(s) failed`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
