/**
 * The custom vocabulary of a document: the words the speech-to-text provider is
 * told to expect.
 *
 * We ask researchers to put participant names and pseudonyms in there, so it is
 * as sensitive as the transcript itself and is stored the same way: an
 * `EncryptedDataEntity` when the user has an encryption key, a plain array when
 * they do not, exactly like `Transcription.speakers`.
 *
 * It is used once, when the transcription is created: the provider needs the
 * words in the clear, in the same request that receives them. Nothing reads it
 * afterwards except the account data export, which decrypts it like every other
 * field. That is why encrypting it costs nothing.
 */

import {
  EncryptionUtils,
  type CryptoCompat,
  type EncryptedDataEntity,
} from "@/lib/encryption/encryption-entities";

/** What the `vocabulary` column holds: readable, or encrypted like the content. */
export type StoredVocabulary = string[] | EncryptedDataEntity;

export function isEncryptedVocabulary(
  value: unknown,
): value is EncryptedDataEntity {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as EncryptedDataEntity).privateKeys) &&
    typeof (value as EncryptedDataEntity).payload === "string"
  );
}

/** Splits the raw form field into words, dropping blanks and duplicates. */
export function parseVocabulary(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((word) => word.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * What to write in the column. Without a public key there is nothing to encrypt
 * for, and the rest of the document is in clear anyway.
 */
export async function vocabularyToStore(
  words: string[],
  owner: { id: string; publicKey: string | null | undefined },
  crypto: CryptoCompat,
): Promise<StoredVocabulary> {
  if (!owner.publicKey || words.length === 0) return words;

  const encryption = new EncryptionUtils(crypto);
  return encryption.createEncryptedDataEntity(words, [
    await encryption.createEncryptedAccessorEntity(owner.id, owner.publicKey),
  ]);
}
