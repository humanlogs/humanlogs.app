---
title: Codebooks
description: Define the codes you will apply to your material — from a preset or from scratch.
order: 1
status: beta
updated: 2026-07-28
related: organize/studies, analysis/learn-more
---

A codebook is a set of codes you apply to your material: themes, sentiment, discourse markers, whatever your analysis tracks.

**What exists today is the codebook itself** — defining codes, organising them, scoping them to studies. Applying those codes to passages of a transcript is the next step and is not shipped yet; see [Export](/docs/coding/export) for what to do in the meantime.

Defining your codebooks now is not wasted work: they will apply to your existing documents when coding lands.

## Create one

Open a study and create a codebook. You are offered a set of **presets** first: picking one fills the form — it creates nothing by itself, so you review, rename and edit before saving. **Continue manually** starts from an empty form.

The presets that ship today:

- **Sentiment** — valence of what is said, in six steps rather than a positive/negative split, because a plain split loses the hedged answers that usually matter most.
- **TAT — discourse procedures** — the French TAT grid, series A, B, C and E. Labels stay in the terminology of their source literature; renaming after creation is one click.
- **Interview structure** — coding the shape of the exchange rather than its content.
- **Document status** — sorting at document level: to review, usable, discarded.

## What a codebook defines

- **Name** — what you are tracking.
- **Studies** — all of them, or a selection. A codebook scoped to one study stays out of the way of the others.
- **Applies to** — whole document, sentence, part of a sentence, or word. This sets the granularity at which the codes will be applied, and it is worth thinking about: document-level codes sort a corpus, word-level codes describe a lexicon, and the two rarely belong in the same codebook.
- **Codes** — a list, each with a label and a colour. Codes can hold sub-codes, so a hierarchy like *Difficulties → material, institutional, personal* is one codebook rather than three.

Deleting a codebook deletes its sub-codebooks; documents keep the codes they got from other codebooks.

## Encryption

Codes are encrypted like your documents: only you and the people your documents are shared with can read them. On a device without your key, a codebook shows as locked until you import your certificate — see [Encryption and account recovery](/docs/privacy/encryption).

The identifiers we store carry no meaning — labels live inside the encrypted payload — so the server never learns that you have a code called "abandoned treatment".
