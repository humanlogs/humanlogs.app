---
title: The excerpt table
description: Every coded passage of a study in one panel, filtered, grouped, and exportable as a thematic table.
order: 2
status: beta
updated: 2026-09-23
related: coding/codebooks, coding/export
---

Coding a corpus is only half the work. The other half is reading it back: *every passage I read as "violence", by the people I coded "manager", across these twelve interviews*. That is what the excerpt table is for.

It is a panel docked to the right of a document, in either of its phases, and it answers from a copy of your corpus held **in your browser**. Nothing is sent anywhere to build it, which is also why it works on an end to end encrypted study, where the server cannot read the text at all.

## Opening it

The table icon in the top bar opens and closes it. Entering the coding phase opens it for you, if your screen is wide enough for a second column; close it once and it stops doing that until you reload.

It appears on a document and nowhere else, but what you set on it survives: filter a study down, open a second interview, and the table is still asking the same question.

## What a row is

One row is one **coded passage**: a span of transcript, its speaker, its interview, and the codes on it.

A passage read as two things is **one row with two chips**, not two rows. That matters when you count: the number in the panel header is distinct passages, so a passage under three codes is counted once there and appears under all three headings below.

## Filtering

Every control narrows the same question. Inside one control the options are OR, between controls they are AND. So *codes: violence, silence* and *people: manager* reads as "passages coded violence **or** silence, said by **someone** coded manager".

- **This document / whole study**, which is the first thing you change when you stop checking one interview and start comparing.
- **Codes**, from the verbatim codebooks of the study.
- **Documents and people**, from the speaker codebooks. These narrow *which material counts* before the passages are looked at.
- **Mine / everyone**, when several of you code the same corpus.
- **Search**, matched against the text of the passage, accent and case insensitive.

### People are linked by name

A transcript's speaker id is a position, not an identity: `speaker_1` of one interview has nothing to do with `speaker_1` of the next. Within a study, people are linked by their **name**, normalised, so coding Renée once makes every interview she appears in answer to that code, and grouping by speaker gives her one row rather than one per recording.

This rests on your own naming discipline: two different people must never be given the same name inside one study. A speaker left **unnamed** is linked to nobody, which is deliberate. Guessing there would put one person's words under another person's name.

## Grouping

The same result, read a different way: by code, by codebook, by document, or by speaker. Grouped by code with no code filter, the whole codebook in use is laid out, empty codes included, so what you have **not** coded is as visible as what you have.

## Working from the table

While the interview a row comes from is the one on screen:

- **Click a row** and the transcript scrolls to the passage. Select a passage in the transcript and the table scrolls to its row. It works in both directions, and across documents: clicking a row from another interview opens it on that passage.
- **Play** replays the passage from the audio, when the transcript carries timings.
- **The tag button** puts a code on the passage or takes one off, without leaving the panel. This is how you file an excerpt under a second theme once you notice it belongs there.

Retracting only ever removes **your own** reading. Two researchers who coded a passage the same way made two records, and one stepping back must not erase the other.

Rows from other interviews show no play and no tag button. Both need the document to be open, because a code is stored in the transcript as well as in the database.

## Exporting it

The download button turns what you are looking at into a **Thème / Phrases / Analyse** table, in PDF, Word or CSV. See [Export](/docs/coding/export).

## What it costs

The corpus is indexed in your browser the first time you open the panel on a study, and refreshed after that. A large study takes a while to index, paced deliberately so it does not compete with the app you are actually using, and it resumes across page loads rather than starting again. The panel fills as it goes.

The index holds your transcripts **in clear** on the device, which is what makes the question answerable at all. `Account, then Security` shows what is held and forgets it on request, and signing out of a device you did not mark as trusted wipes it.
