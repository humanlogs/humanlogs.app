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
  target: "sentence",
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
 * Procédés du discours du TAT (grille française), en un seul codebook dont les
 * intitulés portent leur série : A rigidification, B labilité, C évitement du
 * conflit, E émergence des processus primaires. Découper en sous-codebooks par
 * série reste possible à la main.
 *
 * Cette liste est une première mise en forme d'après la grille classique, pas
 * une transcription validée de la feuille de dépouillement — à relire avant un
 * usage sérieux.
 */
const TAT_DISCURSIVE: CodebookPreset = {
  key: "tat-discursive",
  name: "TAT — procédés du discours",
  description: "Procédés discursifs du TAT, séries A, B, C et E.",
  target: "sentence",
  codes: [
    { label: "A1 — Référence à la réalité externe", color: "blue" },
    { label: "A2 — Procédés de type obsessionnel", color: "blue" },
    {
      label: "A3 — Mise en avant d'affects à valeur de défense",
      color: "blue",
    },
    { label: "B1 — Investissement de la relation", color: "rose" },
    { label: "B2 — Dramatisation", color: "rose" },
    { label: "B3 — Procédés de type hystérique", color: "rose" },
    { label: "CI — Inhibition", color: "amber" },
    { label: "CF — Investissement de la réalité externe", color: "amber" },
    { label: "CN — Investissement narcissique", color: "amber" },
    { label: "CM — Instabilité des limites", color: "amber" },
    { label: "CL — Conduites d'évitement", color: "amber" },
    { label: "E1 — Altération de la perception", color: "fuchsia" },
    { label: "E2 — Massivité de la projection", color: "fuchsia" },
    {
      label: "E3 — Désorganisation des repères identitaires et objectaux",
      color: "fuchsia",
    },
    { label: "E4 — Altération du discours", color: "fuchsia" },
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
  target: "sentence",
  codes: [
    { label: "Question", color: "indigo" },
    { label: "Relance", color: "sky" },
    { label: "Récit / réponse", color: "green" },
    { label: "Digression", color: "gray" },
    { label: "Méta-commentaire", color: "violet" },
  ],
};

/** Document-level triage — the one preset that tags whole documents. */
const DOCUMENT_STATUS: CodebookPreset = {
  key: "document-status",
  name: "Statut du document",
  description: "Tri au niveau du document : à relire, exploitable, écarté.",
  target: "document",
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
  DOCUMENT_STATUS,
];

export function getPreset(key: string): CodebookPreset | undefined {
  return CODEBOOK_PRESETS.find((p) => p.key === key);
}
