---
title: Codebooks
description: Define the codes you will apply to your material, and apply them to people and documents.
order: 1
status: beta
updated: 2026-07-28
related: organize/studies, analysis/learn-more
---

A codebook is a set of codes you apply to your material: themes, sentiment, roles, whatever your analysis tracks.

## Two kinds of codebook

The kind is chosen when you create the codebook and decides what its codes can be attached to.

**Speaker codebooks** code *who is in the corpus*: a person, or a whole document. A role, a profile, a status. These work today.

**Verbatim codebooks** code *what is said*: a passage of the transcript. You can define them now, but applying them is not shipped yet, so they sit unused until passage coding lands. See [What is coming](/docs/analysis/learn-more).

## Create one

Open a study and create a codebook. You are offered a set of **presets** first: picking one fills the form, it creates nothing by itself, so you review, rename and edit before saving. **Continue manually** starts from an empty form.

| Preset | Kind | What it codes |
| --- | --- | --- |
| Speaker role | Speaker | The position someone speaks from |
| Document status | Speaker | Sorting an interview: to review, usable, discarded |
| Sentiment | Verbatim | Valence of a statement, in six steps rather than a positive/negative split |
| TAT, discourse procedures | Verbatim | The French TAT grid, series A, B, C and E |
| Interview structure | Verbatim | The shape of the exchange rather than its content |

Preset labels stay in the terminology of their source literature; renaming after creation is one click.

## What a codebook defines

- **Name**: what you are tracking.
- **Studies**: all of them, or a selection. A codebook scoped to one study stays out of the way of the others.
- **Applies to**: speaker or verbatim, as above.
- **Codes**: a list, each with a label and a colour. Codes can hold sub-codes, so a hierarchy like *Difficulties, then material / institutional / personal* is one codebook rather than three.

Deleting a codebook deletes its sub-codebooks; documents keep the codes they got from other codebooks.

## Applying codes

Three places, all for speaker codebooks:

- **A person, from the transcript.** The speaker badge in the editor opens their codes.
- **A document, from its menu.** The document actions carry the same gesture, one level up.
- **A whole study, from the coding board.** The study's coding page lists every document and every person in it, so you can go through a corpus in one pass.

People are grouped **by name across the study**: coding someone once applies to every interview they appear in. That is the point of the board, and the reason renaming speakers properly pays off.

Coding needs write access to the document, like any other change.

## Filtering by code

Once a speaker codebook is in use, the sidebar can group your documents by its codes, which turns a code into a working view of the corpus. Verbatim codebooks group nothing, since their codes never land on a document.

## Encryption

Codes are encrypted like your documents: only you and the people your documents are shared with can read them. On a device without your key, a codebook shows as locked until you import your certificate, see [Encryption and account recovery](/docs/privacy/encryption).

The identifiers we store carry no meaning, labels live inside the encrypted payload, so the server never learns that you have a code called "abandoned treatment".
