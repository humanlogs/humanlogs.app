import { describe, expect, it } from "vitest";
import {
  encodeSpeakerCache,
  groupSpeakersByName,
  parseSpeakers,
  readSpeakerCache,
  sameSpeakers,
  speakerNameKey,
  validateSpeakerCache,
} from "@/lib/transcriptions/speakers";
import type { EncryptionUtils } from "@/lib/encryption/encryption-entities";

/**
 * The roster cache is what lets the study board read "who speaks here" without
 * pulling whole interviews. Two things must hold: it never carries names in
 * clear beside an encrypted transcript, and a stale one is *detected* — it is a
 * cache, so being wrong silently is the only real failure mode.
 */

const entity = {
  version: "v1" as const,
  privateKeys: [
    {
      userId: "u1",
      publicKey: "PUB",
      aesKeyEncrypted: "KEY",
      metadata: {},
    },
  ],
  payload: "ciphertext",
};

/** Stands in for the real crypto: only the call and its argument matter here. */
const fakeUtils = {
  encrypt: async (_reference: unknown, data: unknown) => ({
    ...entity,
    payload: JSON.stringify(data),
  }),
} as unknown as EncryptionUtils;

describe("parseSpeakers", () => {
  it("reads both the bare array and the transcript it comes from", () => {
    const expected = [{ id: "speaker_0", name: "Marie" }];
    expect(parseSpeakers([{ id: "speaker_0", name: "Marie" }])).toEqual(
      expected,
    );
    expect(
      parseSpeakers({
        speakers: [{ id: "speaker_0", name: "Marie" }],
        words: [],
      }),
    ).toEqual(expected);
  });

  it("normalizes a missing or blank name to null", () => {
    expect(
      parseSpeakers([
        { id: "a" },
        { id: "b", name: "   " },
        { id: "c", name: " Léa " },
      ]),
    ).toEqual([
      { id: "a", name: null },
      { id: "b", name: null },
      { id: "c", name: "Léa" },
    ]);
  });

  it("drops entries without a usable id", () => {
    expect(parseSpeakers([{ name: "Nobody" }, null, { id: 4 }])).toEqual([]);
  });

  it("returns null when there is no roster to read", () => {
    expect(parseSpeakers(null)).toBeNull();
    expect(parseSpeakers({ words: [] })).toBeNull();
    expect(parseSpeakers("speaker_0")).toBeNull();
  });
});

describe("readSpeakerCache", () => {
  it("leaves an encrypted cache to the caller to decrypt", () => {
    expect(readSpeakerCache(entity)).toBeNull();
  });

  it("reads a plaintext cache", () => {
    expect(readSpeakerCache([{ id: "a", name: "A" }])).toEqual([
      { id: "a", name: "A" },
    ]);
  });
});

describe("sameSpeakers", () => {
  const roster = [
    { id: "a", name: "Marie" },
    { id: "b", name: null },
  ];

  it("accepts an identical roster", () => {
    expect(sameSpeakers(roster, [...roster])).toBe(true);
  });

  it("catches a rename, a removal and a reorder", () => {
    expect(
      sameSpeakers(roster, [{ id: "a", name: "Marie C." }, roster[1]]),
    ).toBe(false);
    expect(sameSpeakers(roster, [roster[0]])).toBe(false);
    expect(sameSpeakers(roster, [roster[1], roster[0]])).toBe(false);
  });

  it("treats a missing side as different from a present one", () => {
    expect(sameSpeakers(roster, undefined)).toBe(false);
    expect(sameSpeakers(null, undefined)).toBe(true);
  });
});

describe("encodeSpeakerCache", () => {
  const content = { speakers: [{ id: "speaker_0", name: "Marie" }], words: [] };

  it("stores the roster in clear for a plaintext document", async () => {
    expect(await encodeSpeakerCache(content, content, fakeUtils)).toEqual([
      { id: "speaker_0", name: "Marie" },
    ]);
  });

  it("encrypts it for the accessors of an encrypted transcript", async () => {
    const cache = await encodeSpeakerCache(content, entity, fakeUtils);
    expect(cache).toMatchObject({ privateKeys: entity.privateKeys });
    // Wrapped in an object: the browser helper spreads what it decrypts, and an
    // array would come back with numeric keys.
    expect(JSON.parse((cache as typeof entity).payload)).toEqual({
      speakers: [{ id: "speaker_0", name: "Marie" }],
    });
  });

  it("refuses to write names in clear when it cannot encrypt them", async () => {
    expect(await encodeSpeakerCache(content, entity, null)).toBeUndefined();
  });

  it("builds nothing from content it cannot read", async () => {
    expect(await encodeSpeakerCache(entity, entity, fakeUtils)).toBeUndefined();
  });
});

describe("validateSpeakerCache", () => {
  it("takes an entity as-is — the server cannot look inside it", () => {
    expect(validateSpeakerCache(entity)).toEqual({ speakers: entity });
  });

  it("normalizes a plaintext roster and clears on null", () => {
    expect(validateSpeakerCache([{ id: "a", name: " A " }])).toEqual({
      speakers: [{ id: "a", name: "A" }],
    });
    expect(validateSpeakerCache(null)).toEqual({ speakers: null });
  });

  it("rejects anything else", () => {
    expect(validateSpeakerCache("nope")).toHaveProperty("error");
    expect(validateSpeakerCache(42)).toHaveProperty("error");
  });
});

describe("groupSpeakersByName", () => {
  const documents = [
    {
      id: "d1",
      title: "Entretien 01",
      speakers: [
        { id: "speaker_0", name: "Enquêtrice" },
        { id: "speaker_1", name: "Marie" },
      ],
    },
    {
      id: "d2",
      title: "Entretien 02",
      speakers: [
        { id: "speaker_0", name: "  enquetrice " },
        { id: "speaker_1", name: "Karim" },
        { id: "speaker_2", name: null },
      ],
    },
  ];

  it("makes one row per person, whatever the casing, accents or spacing", () => {
    const groups = groupSpeakersByName(documents);
    const interviewer = groups.find((g) => g.key === "name:enquetrice")!;

    expect(interviewer.occurrences).toEqual([
      {
        documentId: "d1",
        documentTitle: "Entretien 01",
        speakerId: "speaker_0",
        index: 0,
      },
      {
        documentId: "d2",
        documentTitle: "Entretien 02",
        speakerId: "speaker_0",
        index: 0,
      },
    ]);
    // The first spelling encountered is the one shown.
    expect(interviewer.name).toBe("Enquêtrice");
  });

  it("keeps an unnamed speaker to itself — nothing identifies it elsewhere", () => {
    const groups = groupSpeakersByName(documents);
    const unnamed = groups.filter((g) => !g.named);

    expect(unnamed).toHaveLength(1);
    expect(unnamed[0].key).toBe("speaker:d2:speaker_2");
    expect(unnamed[0].occurrences[0].index).toBe(2);
  });

  it("sorts named people alphabetically and leaves the unnamed last", () => {
    expect(groupSpeakersByName(documents).map((g) => g.name)).toEqual([
      "Enquêtrice",
      "Karim",
      "Marie",
      null,
    ]);
  });

  it("ignores a document whose roster is not loaded", () => {
    expect(groupSpeakersByName([{ id: "d3", title: "Entretien 03" }])).toEqual(
      [],
    );
  });
});

describe("speakerNameKey", () => {
  it("matches the spellings a researcher means as one person", () => {
    expect(speakerNameKey("Marie")).toBe(speakerNameKey("  marie "));
    expect(speakerNameKey("Enquêtrice")).toBe(speakerNameKey("enquetrice"));
    expect(speakerNameKey("Jean  Pierre")).toBe(speakerNameKey("Jean Pierre"));
  });

  it("keeps distinct people apart", () => {
    expect(speakerNameKey("Marie")).not.toBe(speakerNameKey("Marie C."));
  });
});
