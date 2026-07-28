---
title: Export
description: Every format a transcript can leave HumanLogs in, and which one to pick.
order: 5
status: live
updated: 2026-07-28
related: transcribe/import-text, privacy/encryption
---

Exports are in the document actions, grouped by what you are going to do next. Nothing is metered: exporting is free, as often as you like.

| Format | Group | Use it for |
| --- | --- | --- |
| Word (`.docx`) | Document | Sharing, annotating, appendices |
| PDF | Document | Fixed-layout circulation |
| Text (`.txt`) | Document | Plain text, with options |
| NVivo | Qualitative analysis | Import into NVivo |
| MAXQDA | Qualitative analysis | Import into MAXQDA |
| CSV | Qualitative analysis | Spreadsheets, statistics, scripts |
| SRT | Subtitles | Video subtitles |
| WebVTT | Subtitles | Web video subtitles |
| JSON | Data | Pipelines and tooling |

Your audio is downloadable too, from the same menu: the **original file** byte for byte, or an **MP3** copy, handy for sharing a recording that was uploaded as a large WAV.

## For qualitative software

The **NVivo** and **MAXQDA** exports produce files those tools import as *transcripts*, with speaker attribution and timing rather than a flat wall of text. Speaker names become the speaker field, so speaker-based queries work immediately.

Both formats can also be [imported back](/docs/transcribe/import-text), which is useful when a colleague sends material from their own toolchain.

## For subtitles

**SRT** for video editors and players, **WebVTT** for HTML5 video on the web. Both carry the timings from the transcript, corrections included, which is the point of correcting in a synced editor in the first place. To check a subtitle file before shipping it, the free [SRT tester](/tools/srt-tester) plays it against your video in the browser.

## For spreadsheets and scripts

**CSV** gives one row per segment, with speaker, timing and text, open it in a spreadsheet or feed it to a statistics tool. **JSON** gives the full structured document, for scripts and pipelines.

## Text options

The text export opens an options dialog, which is where most of the fine control lives:

- **Speakers**: everyone, or a single speaker's contributions only.
- **Case**: as transcribed, lowercase, lowercase without accents, or lowercase without accents and punctuation. The last two are what lexical tools usually expect.
- **Speaker names**: shown or hidden.
- **Line breaks**: kept, or removed to produce one continuous block.

Between them, these produce either a readable transcript or a normalised corpus ready for text analysis.

## Encrypted documents

Exports are produced in your browser from the decrypted document, so an encrypted document exports exactly like any other, the clear text is never sent back to us. Audio is decrypted locally before the download starts, so the file you get plays anywhere.
