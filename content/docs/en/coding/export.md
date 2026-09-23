---
title: Export
description: Get a thematic table of your coded passages out as PDF, Word or CSV, and what is still missing.
order: 3
status: beta
updated: 2026-09-23
related: coding/excerpts, transcribe/export
---

Coded passages come out of HumanLogs as the table qualitative analysis actually ends in: one row per theme, the passages that support it, and a column for what you make of them.

## Exporting the table

Open the [excerpt table](/docs/coding/excerpts), filter it down to what you want, then use the download button in its header. Three formats:

- **PDF**, to circulate and annotate on paper.
- **Word**, to write the analysis *into*. The third column is a real cell with a caret in it.
- **CSV**, to pivot in a spreadsheet or feed to a script.

Each passage is quoted with its speaker, its interview, and a timecode when the transcript carries one, so a verbatim stays checkable against the recording once it is in a paper.

## Three columns

| Column | Holds |
| --- | --- |
| Thème | The code |
| Phrases | Every passage read as that code, quoted and attributed |
| Analyse | Empty, for you |

The third column is deliberately blank. The tool holds the evidence; the interpretation is yours, and shipping that column pre-filled with a count or a summary would be the software making a claim about your material.

## Two things to know before you click

**It is always grouped by code**, whatever the table on screen is grouped by. The first column of a thematic table is a theme or the table is something else. Everything you *filtered* is respected in full.

**It is not an export of what is on screen.** The panel shows a few pages of each theme and counts the rest, which is what keeps it fast. The export runs its own deeper pass, so you get the passages you filtered rather than the ones you happened to have scrolled to. Themes are capped at 2000 passages each, and the menu says how many the file will hold before you click, so a truncation is visible in advance rather than discovered in the file.

## What is still missing

- Speaker and document codes carried into the NVivo and MAXQDA transcript exports, so a coded corpus moves in one piece.
- Codebook export and import, to share a grid between projects or with a co-coder.
- A raw CSV of coded items for statistics and scripts, one row per passage rather than one per theme.

## Working in another tool

If your method lives in NVivo or MAXQDA, export the transcript rather than the table: it arrives as a proper transcript, with speakers and timings, so your codes attach to real passages rather than to a wall of text. See [Export](/docs/transcribe/export) for the full list and the text options.
