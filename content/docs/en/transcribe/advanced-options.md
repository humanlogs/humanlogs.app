---
title: Advanced options
description: Language, speakers, custom vocabulary, audio events, pause markers and where your audio is processed.
order: 4
status: live
updated: 2026-07-28
related: transcribe/import-audio, privacy/encryption
---

Most of the quality of a transcript is decided before it starts, on the upload screen. These are the settings worth two minutes of your time.

## Language

Pick the language spoken in the recording. This is the single setting with the largest effect on accuracy, and the one worth double-checking.

One language per document. A bilingual interview is transcribed in the language you pick, and the other-language passages come out approximate. Transcribe it twice, as two documents, if both matter to your analysis.

## Number of speakers

Speaker detection, *diarization*, separates who says what, and telling it how many people are in the room makes it noticeably more reliable than letting it guess.

- **One speaker** for a lecture, a dictated memo or a field note.
- **A number** when you know it: an interview with one participant is two.
- **More than ten** for a focus group or a public meeting.

Detection is never perfect on overlapping speech. You can rename, reassign and merge speakers afterwards, see [Navigation](/docs/transcribe/navigation).

## Custom vocabulary

A list of words to expect: participant names and pseudonyms, institutions, technical terms, local place names, acronyms from your field.

This is the highest-return field on the screen. Speech recognition fails predictably on rare proper nouns, and a dozen entries here can remove a hundred find-and-replace operations later. If you run a series of interviews on one topic, keep the list in a note and paste it each time.

## Tag audio events

Marks non-speech events, laughter, background noise, in the transcript.

Useful when paralinguistic material is part of your analysis, noise when it is not. If you are analysing what was said rather than how the room felt, leave it off.

## Where your audio is processed

Speech recognition runs on a specialised provider, and you choose which region handles your audio. The selector appears when both are configured on your instance, and defaults to your account's residency preference, then to your last choice.

**EU**: processed by a European provider under a zero-retention policy. The option to pick if your ethics board or DPA requires European processing. Per-file limit: **135 minutes**.

**US**: processed by a US provider, also under a zero-retention policy. No per-file duration limit.

The provider used is recorded on each document, so you can always tell where a given recording was processed. The account-wide preference is set during onboarding and can be changed in your account.

Note what encryption does and does not cover here: the audio has to be decrypted to be transcribed by the provider, which is exactly why the region matters. See [Encryption and account recovery](/docs/privacy/encryption).

## Pause markers

Pauses are a setting on the document rather than on the upload, in the pause configuration dialog.

The editor counts pauses over **1 second** (short) and over **3 seconds** (long), and can insert a marker for each, `(pause)` and `(long pause)` by default, or wording of your own. The dialog tells you how many of each the recording contains before you commit to marking them.

Turn it on when the length of a hesitation is data. Leave it off when it is noise.
