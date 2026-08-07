import { describe, expect, it } from "vitest";
import { prefixRange, searchTokens, tokenize } from "@/lib/local/phrase-tokens";

/**
 * The word index is what turned free text from a full pass over the study into a
 * key range. Everything it can get wrong is invisible: a word that is indexed under
 * a form nobody types, or a query folded differently from the corpus it searches.
 */

describe("tokenize", () => {
  it("folds case and accents, so a corpus and a query meet", () => {
    expect(tokenize("Hôpital")).toEqual(tokenize("hopital"));
  });

  it("splits elision and hyphens, which French is made of", () => {
    expect(tokenize("l'hôpital")).toEqual(["hopital"]);
    expect(tokenize("sous-traitance").sort()).toEqual(["sous", "traitance"]);
    // «qu» survives, being two letters. Filtering it would mean a French
    // stopword list, which is a different kind of decision than a length floor
    // and wrong the moment a corpus is not in French.
    expect(tokenize("qu'est-ce qu'on").sort()).toEqual([
      "ce",
      "est",
      "on",
      "qu",
    ]);
  });

  it("drops single letters", () => {
    // Elision would otherwise make «l», «d», «j» the most common entries in the
    // whole index, one per passage, for a query nobody types.
    expect(tokenize("il y a l'eau")).toEqual(["il", "eau"]);
  });

  it("counts a repeated word once", () => {
    expect(tokenize("on on on nous crie")).toEqual(["on", "nous", "crie"]);
  });

  it("keeps digits, which timings and ages are made of", () => {
    expect(tokenize("35 ans")).toEqual(["35", "ans"]);
  });

  it("is empty for punctuation alone", () => {
    expect(tokenize("… — !")).toEqual([]);
  });
});

describe("searchTokens", () => {
  it("cannot narrow on a blank or one-letter query", () => {
    // Read by the caller as "no text filter": typing the first letter of a word
    // must not empty the table.
    for (const query of ["", "   ", "l", "l'", "à"]) {
      expect(searchTokens(query)).toEqual([]);
    }
  });

  it("asks for every word of the query", () => {
    expect(searchTokens("crie dessus").sort()).toEqual(["crie", "dessus"]);
  });
});

describe("prefixRange", () => {
  it("covers the word itself and everything continuing it", () => {
    const { lower, upper } = prefixRange("cade");
    expect("cade" >= lower && "cade" <= upper).toBe(true);
    expect("cadence" >= lower && "cadence" <= upper).toBe(true);
    // And stops at the next word.
    expect("cadre" <= upper).toBe(false);
    expect("cad" >= lower).toBe(false);
  });
});
