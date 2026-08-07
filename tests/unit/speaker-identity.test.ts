import { describe, expect, it } from "vitest";
import { speakerKey, speakersMatchingCodes } from "@/lib/local/phrase-query";
import { streamFromLinks } from "@/lib/local/phrase-stream";
import type { PhraseCodeRow } from "@/lib/local/phrase-index";
import {
  buildSpeakerIdentity,
  normalizeSpeakerName,
  speakerPersonMap,
  speakersMatchingCodesByPerson,
  type SpeakerRoster,
} from "@/lib/local/speaker-identity";

/**
 * A transcript's speaker id is a POSITION — `speaker_1` of one interview is not
 * `speaker_1` of the next — and within a study a researcher never gives two people
 * the same name. So the name is the link, and the two failure modes are opposite:
 * failing to link Renée to herself, and merging two strangers who are both unnamed.
 */

const code = (codeId: string) => ({ codebookId: "cb1", codeId });
const speakerCode = (speakerId: string, codeId: string) => ({
  ...code(codeId),
  speakerId,
});

/** Renée is interviewed twice; Marc once; one roster leaves a speaker unnamed. */
const study: SpeakerRoster[] = [
  {
    id: "docA",
    speakers: [
      { id: "speaker_0", name: "Renée" },
      { id: "speaker_1", name: "Marc" },
    ],
    speakerCodes: [speakerCode("speaker_0", "cadre")],
  },
  {
    id: "docB",
    // Same person, typed differently — and a second, unnamed voice.
    speakers: [
      { id: "speaker_0", name: "renee " },
      { id: "speaker_1", name: null },
    ],
    speakerCodes: [],
  },
  {
    id: "docC",
    speakers: [{ id: "speaker_0", name: null }],
    codes: [code("hopital")],
    speakerCodes: [],
  },
];

describe("normalizeSpeakerName", () => {
  it("folds case, accents, punctuation and stray whitespace", () => {
    const forms = ["Renée", "renee", "RENÉE:", "  Renée  ", "Renée."];
    expect(new Set(forms.map(normalizeSpeakerName)).size).toBe(1);
  });

  it("keeps two different people apart", () => {
    expect(normalizeSpeakerName("Renée")).not.toBe(
      normalizeSpeakerName("René"),
    );
  });

  it("is nothing for an unnamed speaker", () => {
    // The one case that must NOT link: nameless speakers of different interviews
    // are different people, and guessing would merge strangers.
    for (const value of [null, undefined, "", "   ", "—"]) {
      expect(normalizeSpeakerName(value)).toBeNull();
    }
  });
});

describe("buildSpeakerIdentity", () => {
  const identity = buildSpeakerIdentity(study);

  it("links the same name across interviews", () => {
    expect(identity.personOf("docA", "speaker_0")).toBe(
      identity.personOf("docB", "speaker_0"),
    );
    expect(identity.documentCount(identity.personOf("docA", "speaker_0"))).toBe(
      2,
    );
  });

  it("leaves unnamed speakers as themselves", () => {
    const b = identity.personOf("docB", "speaker_1");
    const c = identity.personOf("docC", "speaker_0");
    expect(b).not.toBe(c);
    expect(identity.documentCount(b)).toBe(1);
  });

  it("gives every pair a person, including one the roster never listed", () => {
    // A speaker present in the transcript but missing from the cached roster:
    // their own person, which is what the index did before anyone was linked.
    expect(identity.personOf("docA", "speaker_9")).toBe(
      speakerKey("docA", "speaker_9"),
    );
  });

  it("reports every pair a person speaks under", () => {
    expect(
      [...identity.pairsOf(identity.personOf("docA", "speaker_0"))].sort(),
    ).toEqual(["docA:speaker_0", "docB:speaker_0"]);
  });
});

describe("speakersMatchingCodesByPerson", () => {
  const identity = buildSpeakerIdentity(study);
  const rosterOf = (documentId: string) =>
    study.find((doc) => doc.id === documentId)?.speakers.map((s) => s.id) ?? [];

  it("follows a coded person into the other interviews of the study", () => {
    const keys = speakersMatchingCodesByPerson(
      study,
      [code("cadre")],
      identity,
      rosterOf,
    );
    // Renée is coded «cadre» in docA only; her docB passages are hers too.
    expect([...keys].sort()).toEqual(["docA:speaker_0", "docB:speaker_0"]);
  });

  it("is what the per-document rule is NOT", () => {
    // The behaviour this replaces, kept as the contrast: it stopped at docA.
    expect(speakersMatchingCodes(study, [code("cadre")], rosterOf)).toEqual([
      "docA:speaker_0",
    ]);
  });

  it("keeps a code on the INTERVIEW from travelling", () => {
    // "This interview is about the hospital" says nothing about where the people
    // in it speak elsewhere, so it selects that interview's speakers and stops.
    expect(
      speakersMatchingCodesByPerson(
        study,
        [code("hopital")],
        identity,
        rosterOf,
      ),
    ).toEqual(["docC:speaker_0"]);
  });

  it("keeps everyone when nothing is asked for", () => {
    expect(
      speakersMatchingCodesByPerson(study, [], identity, rosterOf).sort(),
    ).toEqual([
      "docA:speaker_0",
      "docA:speaker_1",
      "docB:speaker_0",
      "docB:speaker_1",
      "docC:speaker_0",
    ]);
  });
});

describe("grouping by speaker", () => {
  const link = (
    documentId: string,
    speakerId: string,
    phraseId: string,
  ): PhraseCodeRow => ({
    phraseId,
    codingId: `${phraseId}-c`,
    documentId,
    projectId: "study1",
    speakerId,
    codebookId: "cb1",
    codeId: "violence",
    userId: "u1",
    offset: 0,
  });

  const links = [
    link("docA", "speaker_0", "docA#1"),
    link("docB", "speaker_0", "docB#1"),
    link("docB", "speaker_1", "docB#2"),
  ];

  it("puts one person's passages in one group across interviews", () => {
    const groups = streamFromLinks(links, {
      groupBy: "speaker",
      speakerPersons: speakerPersonMap(study),
    }).groups;
    const renee = groups.find((g) => g.key === "speaker:name:renee");
    expect(renee?.count).toBe(2);
    // The unnamed voice of docB stays its own group.
    expect(groups).toHaveLength(2);
  });

  it("falls back to one group per (document, speaker) with no identity", () => {
    expect(streamFromLinks(links, { groupBy: "speaker" }).groups).toHaveLength(
      3,
    );
  });
});
