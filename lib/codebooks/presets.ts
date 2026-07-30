/**
 * Ready-made codebooks a researcher can start from. Picking one prefills the
 * creation form — it does not create anything by itself — so every preset
 * describes exactly one codebook, and the researcher reviews and edits it
 * before saving.
 *
 * This is plain data: editing this file is the only thing needed to change a
 * preset. The code ids are NOT taken from here — they are freshly generated
 * uuids when the form is filled, precisely so the server never sees a
 * meaningful identifier (see `lib/codebooks/codebook.ts`).
 *
 * Labels stay in the terminology of their source literature rather than being
 * translated: the TAT grid is a French instrument, and renaming after creation
 * is one click away.
 */

import type { CodebookTarget } from "./codebook";

export type PresetCode = {
  label: string;
  /** Palette key from `PROJECT_COLORS`. */
  color?: string;
  description?: string;
  /**
   * Sub-codes. A preset that ships a real hierarchy has to say so here: flattening
   * a grid that has series into one list loses the level researchers actually think
   * in, and turns a two-keystroke shortcut ("A" then "B") into a scan of fifteen
   * rows. Sub-codes carry no colour of their own — they inherit their parent's.
   */
  children?: PresetCode[];
};

export type CodebookPreset = {
  key: string;
  /** Prefilled name; the researcher can change it before saving. */
  name: string;
  description: string;
  target: CodebookTarget;
  codes: PresetCode[];
};

/**
 * Valence of what is said. Deliberately six steps: a plain positive/negative
 * split loses the hedged answers that matter most in interviews.
 */
const SENTIMENT: CodebookPreset = {
  key: "sentiment",
  name: "Sentiment",
  description: "Valence du propos, du très positif à l'ambivalent.",
  target: "verbatim",
  codes: [
    { label: "Positif", color: "green" },
    { label: "Plutôt positif", color: "teal" },
    { label: "Neutre", color: "slate" },
    { label: "Plutôt négatif", color: "orange" },
    { label: "Négatif", color: "red" },
    {
      label: "Ambivalent",
      color: "violet",
      description: "Valences opposées tenues ensemble dans le même énoncé.",
    },
  ],
};

/**
 * Procédés du discours du TAT (grille française), en un seul codebook structuré
 * par série : A rigidification, B labilité, C évitement du conflit, E émergence
 * des processus primaires. La série est le code parent — c'est le niveau auquel
 * on lit une feuille de dépouillement — et les procédés en sont les sous-codes.
 *
 * Cette liste est une première mise en forme d'après la grille classique, pas
 * une transcription validée de la feuille de dépouillement — à relire avant un
 * usage sérieux.
 */
const TAT_DISCURSIVE: CodebookPreset = {
  key: "tat-discursive",
  name: "TAT — procédés du discours",
  description: "Procédés discursifs du TAT, séries A, B, C et E.",
  target: "verbatim",
  codes: [
    {
      label: "A — Rigidification",
      color: "blue",
      description: "Référence à des procédés de type obsessionnel.",
      children: [
        { label: "A1 — Référence à la réalité externe" },
        { label: "A2 — Procédés de type obsessionnel" },
        { label: "A3 — Mise en avant d'affects à valeur de défense" },
      ],
    },
    {
      label: "B — Labilité",
      color: "rose",
      children: [
        { label: "B1 — Investissement de la relation" },
        { label: "B2 — Dramatisation" },
        { label: "B3 — Procédés de type hystérique" },
      ],
    },
    {
      label: "C — Évitement du conflit",
      color: "amber",
      children: [
        { label: "CI — Inhibition" },
        { label: "CF — Investissement de la réalité externe" },
        { label: "CN — Investissement narcissique" },
        { label: "CM — Instabilité des limites" },
        { label: "CL — Conduites d'évitement" },
      ],
    },
    {
      label: "E — Émergence des processus primaires",
      color: "fuchsia",
      children: [
        { label: "E1 — Altération de la perception" },
        { label: "E2 — Massivité de la projection" },
        {
          label: "E3 — Désorganisation des repères identitaires et objectaux",
        },
        { label: "E4 — Altération du discours" },
      ],
    },
  ],
};

/**
 * Who is speaking and in what move — separates the interviewer's framing from
 * the participant's account before any thematic work.
 */
const INTERVIEW_STRUCTURE: CodebookPreset = {
  key: "interview-structure",
  name: "Structure d'entretien",
  description:
    "Type de tour de parole : question, relance, récit, digression, méta-commentaire.",
  target: "verbatim",
  codes: [
    { label: "Question", color: "indigo" },
    { label: "Relance", color: "sky" },
    { label: "Récit / réponse", color: "green" },
    { label: "Digression", color: "gray" },
    { label: "Méta-commentaire", color: "violet" },
  ],
};

/**
 * Who the speaker is in the encounter — the first thing to settle before any
 * attribute of the person, and the one grid that is the same in every study.
 * Attributes proper (âge, profession, groupe) are too study-specific to ship as
 * a preset; they are added as codes of a second speaker codebook.
 */
const SPEAKER_ROLE: CodebookPreset = {
  key: "speaker-role",
  name: "Rôle du locuteur",
  description:
    "Place du locuteur dans l'entretien : enquêté, enquêteur, tiers.",
  target: "speaker",
  codes: [
    { label: "Enquêté·e", color: "green" },
    { label: "Enquêteur·rice", color: "indigo" },
    { label: "Tiers présent", color: "amber" },
    {
      label: "Non identifié",
      color: "gray",
      description: "Locuteur que la diarisation n'a pas su rattacher.",
    },
  ],
};

/**
 * Triage of the interview as a whole — a speaker codebook applied at the
 * document level rather than to one of its speakers.
 */
const DOCUMENT_STATUS: CodebookPreset = {
  key: "document-status",
  name: "Statut du document",
  description: "Tri au niveau du document : à relire, exploitable, écarté.",
  target: "speaker",
  codes: [
    { label: "À relire", color: "amber" },
    { label: "Exploitable", color: "green" },
    { label: "Cas exemplaire", color: "violet" },
    { label: "Écarté", color: "gray" },
  ],
};

export const CODEBOOK_PRESETS: CodebookPreset[] = [
  SENTIMENT,
  TAT_DISCURSIVE,
  INTERVIEW_STRUCTURE,
  SPEAKER_ROLE,
  DOCUMENT_STATUS,
];

/** How many codes a preset ships, sub-codes included — what its card announces. */
export function countPresetCodes(codes: PresetCode[]): number {
  return codes.reduce(
    (total, code) => total + 1 + countPresetCodes(code.children ?? []),
    0,
  );
}

export function getPreset(key: string): CodebookPreset | undefined {
  return CODEBOOK_PRESETS.find((p) => p.key === key);
}
