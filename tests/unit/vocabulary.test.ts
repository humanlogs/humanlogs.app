import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  EncryptionUtils,
  type CryptoCompat,
} from "@/lib/encryption/encryption-entities";
import {
  isEncryptedVocabulary,
  parseVocabulary,
  vocabularyToStore,
} from "@/lib/transcriptions/vocabulary";

/**
 * The custom vocabulary is the one field we ask researchers to fill with
 * participant names, so what lands in the column matters: encrypted for the
 * owner, or nothing at all — never clear text belonging to a user who has a
 * key.
 */

const utils = new EncryptionUtils(crypto as unknown as CryptoCompat);

function keypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

describe("parseVocabulary", () => {
  it("splits, trims and drops blanks and duplicates", () => {
    expect(parseVocabulary(" Camille , CHU ,, Camille , ")).toEqual([
      "Camille",
      "CHU",
    ]);
  });

  it("treats a missing field as no vocabulary", () => {
    expect(parseVocabulary(undefined)).toEqual([]);
    expect(parseVocabulary("")).toEqual([]);
    expect(parseVocabulary("  , ,")).toEqual([]);
  });
});

describe("vocabularyToStore", () => {
  it("encrypts for an owner who has a key, and round-trips", async () => {
    const { publicKey, privateKey } = keypair();
    const words = ["Camille Rousseau", "CHU de Lille"];

    const stored = await vocabularyToStore(
      words,
      { id: "user-1", publicKey },
      crypto as unknown as CryptoCompat,
    );

    expect(isEncryptedVocabulary(stored)).toBe(true);
    // The point of the whole change: the names must not be readable in what we
    // persist.
    expect(JSON.stringify(stored)).not.toContain("Camille");

    const decrypted = await utils.decrypt<string[]>(
      stored as never,
      privateKey,
      publicKey,
    );
    expect(decrypted).toEqual(words);
  });

  it("stays a plain array when the user has no key", async () => {
    const stored = await vocabularyToStore(
      ["Euh", "Hmm"],
      { id: "user-1", publicKey: null },
      crypto as unknown as CryptoCompat,
    );

    expect(stored).toEqual(["Euh", "Hmm"]);
  });

  it("does not build an entity for an empty vocabulary", async () => {
    const { publicKey } = keypair();

    const stored = await vocabularyToStore(
      [],
      { id: "user-1", publicKey },
      crypto as unknown as CryptoCompat,
    );

    expect(stored).toEqual([]);
  });
});
