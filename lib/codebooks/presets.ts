/**
 * Ready-made codebooks a researcher can start from. Instantiating a preset
 * always creates codebooks scoped to **all studies**, as agreed.
 *
 * This is plain data: labels are meant to be read and corrected by researchers,
 * and editing this file is the only thing needed to change a preset. The code
 * ids are NOT taken from here — they are freshly generated uuids at
 * instantiation, precisely so the server never sees a meaningful identifier
 * (see `lib/codebooks/codebook.ts`).
 *
 * Preset labels are intentionally left in the terminology of their source
 * literature rather than translated: the TAT grid is a French instrument, and
 * renaming after creation is one click away.
 */

import type { CodebookTarget } from "./codebook";

export type PresetCode = {
  label: string;
  /** Palette key from `PROJECT_COLORS`. */
  color?: string;
  description?: string;
};

export type PresetCodebook = {
  name: string;
  codes: PresetCode[];
  children?: PresetCodebook[];
};

export type CodebookPreset = {
  key: string;
  label: string;
  description: string;
  target: CodebookTarget;
  codebooks: PresetCodebook[];
  /**
   * True while the content still needs a domain review. Surfaced in the picker
   * so nobody mistakes a draft for an authoritative grid.
   */
  draft?: boolean;
};

/**
 * Valence of what is said. Deliberately six steps: a plain positive/negative
 * split loses the hedged answers that matter most in interviews.
 */
const SENTIMENT: CodebookPreset = {
  key: "sentiment",
  label: "Sentiment",
  description: "Valence du propos, du très positif à l'ambivalent.",
  target: "sentence",
  codebooks: [
    {
      name: "Sentiment",
      codes: [
        { label: "Positif", color: "green" },
        { label: "Plutôt positif", color: "teal" },
        { label: "Neutre", color: "slate" },
        { label: "Plutôt négatif", color: "orange" },
        { label: "Négatif", color: "red" },
        {
          label: "Ambivalent",
          color: "violet",
          description:
            "Valences opposées tenues ensemble dans le même énoncé.",
        },
      ],
    },
  ],
};

/**
 * Procédés du discours du TAT (grille française, séries A / B / C / E), en un
 * codebook parent et quatre séries filles.
 *
 * DRAFT — à relire contre le manuel de référence avant usage sérieux : les
 * intitulés ci-dessous sont une première mise en forme, pas une transcription
 * validée de la feuille de dépouillement.
 */
const TAT_DISCURSIVE: CodebookPreset = {
  key: "tat-discursive",
  label: "Discursive TAT categories",
  description:
    "Procédés du discours du TAT, organisés en séries A, B, C et E (brouillon à valider).",
  target: "sentence",
  draft: true,
  codebooks: [
    {
      name: "TAT — procédés du discours",
      codes: [],
      children: [
        {
          name: "A — Rigidification",
          codes: [
            { label: "A1 — Référence à la réalité externe", color: "blue" },
            { label: "A2 — Procédés de type obsessionnel", color: "blue" },
            {
              label: "A3 — Mise en avant d'affects à valeur de défense",
              color: "blue",
            },
          ],
        },
        {
          name: "B — Labilité",
          codes: [
            { label: "B1 — Investissement de la relation", color: "rose" },
            { label: "B2 — Dramatisation", color: "rose" },
            { label: "B3 — Procédés de type hystérique", color: "rose" },
          ],
        },
        {
          name: "C — Évitement du conflit",
          codes: [
            { label: "CI — Inhibition", color: "amber" },
            { label: "CF — Investissement de la réalité externe", color: "amber" },
            { label: "CN — Investissement narcissique", color: "amber" },
            { label: "CM — Instabilité des limites", color: "amber" },
            { label: "CL — Conduites d'évitement", color: "amber" },
          ],
        },
        {
          name: "E — Émergence des processus primaires",
          codes: [
            { label: "E1 — Altération de la perception", color: "fuchsia" },
            { label: "E2 — Massivité de la projection", color: "fuchsia" },
            {
              label: "E3 — Désorganisation des repères identitaires et objectaux",
              color: "fuchsia",
            },
            { label: "E4 — Altération du discours", color: "fuchsia" },
          ],
        },
      ],
    },
  ],
};

/**
 * Proposal — who is speaking and in what move. Useful to separate the
 * interviewer's framing from the participant's account before any thematic
 * work. Keep or drop.
 */
const INTERVIEW_STRUCTURE: CodebookPreset = {
  key: "interview-structure",
  label: "Structure d'entretien",
  description:
    "Type de tour de parole : question, relance, récit, digression, méta-commentaire.",
  target: "sentence",
  draft: true,
  codebooks: [
    {
      name: "Structure d'entretien",
      codes: [
        { label: "Question", color: "indigo" },
        { label: "Relance", color: "sky" },
        { label: "Récit / réponse", color: "green" },
        { label: "Digression", color: "gray" },
        { label: "Méta-commentaire", color: "violet" },
      ],
    },
  ],
};

/**
 * Proposal — document-level triage, the one preset that tags whole documents
 * rather than passages. Keep or drop.
 */
const DOCUMENT_STATUS: CodebookPreset = {
  key: "document-status",
  label: "Statut du document",
  description: "Tri au niveau du document : à relire, exploitable, écarté.",
  target: "document",
  draft: true,
  codebooks: [
    {
      name: "Statut du document",
      codes: [
        { label: "À relire", color: "amber" },
        { label: "Exploitable", color: "green" },
        { label: "Cas exemplaire", color: "violet" },
        { label: "Écarté", color: "gray" },
      ],
    },
  ],
};

export const CODEBOOK_PRESETS: CodebookPreset[] = [
  SENTIMENT,
  TAT_DISCURSIVE,
  INTERVIEW_STRUCTURE,
  DOCUMENT_STATUS,
];

export function getPreset(key: string): CodebookPreset | undefined {
  return CODEBOOK_PRESETS.find((p) => p.key === key);
}
