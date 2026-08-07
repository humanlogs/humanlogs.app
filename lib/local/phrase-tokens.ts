/**
 * Words, for searching a corpus you cannot afford to read.
 *
 * Free text was the one slow shape left in the panel: matching text needs the
 * passages themselves, so a search meant a full pass over every phrase of a study
 * — 6.3s at 200k, before the coded links were walked at all. Every other filter
 * answers from an index; this one had none.
 *
 * So each passage stores the set of words it contains, and IndexedDB indexes that
 * array with `multiEntry`, which files one entry per word. "the passages containing
 * «cadence»" then becomes a key range rather than a scan.
 *
 * **The semantics change, deliberately.** The scan matched any substring, so
 * «essus» found «dessus». This matches WORD PREFIXES, all of which must be present:
 * «cri dess» finds «on nous crie dessus», and «essus» finds nothing. That is how
 * people search a corpus, and it is the shape an index can serve. Elision and
 * hyphens split, so «l'hôpital» is indexed under «l» and «hopital» and searching
 * either finds it.
 */

/**
 * Words shorter than this are neither indexed nor searched.
 *
 * French elides constantly — l', d', j', n', s', c', m', t' — so single letters
 * would be the most common entries in the index by a wide margin, one per passage,
 * for a query nobody types. A one-letter query simply does not narrow.
 */
const MIN_TOKEN = 2;

/** Fold to the form two spellings must share: no case, no accents. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * The distinct words of a passage, folded.
 *
 * Deduplicated because the index answers "does this passage contain the word", not
 * "how often" — a repeated word is one entry, and a passage that says «on» four
 * times should not cost four.
 */
export function tokenize(text: string): string[] {
  const out = new Set<string>();
  for (const raw of fold(text).split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length >= MIN_TOKEN) out.add(raw);
  }
  return [...out];
}

/**
 * What a query asks for: the words that must all be present, as prefixes.
 *
 * Returns an empty array for a query that cannot narrow — blank, or nothing but
 * single letters — which the caller reads as "no text filter" rather than as "no
 * results". Typing the first letter of a word should not empty the table.
 */
export function searchTokens(query: string): string[] {
  return tokenize(query);
}

/**
 * The key range covering every indexed word starting with `prefix`.
 *
 * `￿` as the upper bound: it sorts after any character that can follow the
 * prefix in a real word, which is what turns "starts with" into a range over an
 * ordered index.
 */
export function prefixRange(prefix: string): { lower: string; upper: string } {
  return { lower: prefix, upper: `${prefix}￿` };
}
