---
title: Learn more
description: Lexical statistics, co-occurrence, clustering and cross-interview comparison: what is coming, and what to do meanwhile.
order: 1
status: soon
updated: 2026-07-28
related: transcribe/export, coding/codebooks
---

**Nothing in this section has shipped.** Analysis is the last stage of the journey we are building: transcribe, code, then analyse a coded corpus without leaving the workspace.

This page exists so you can judge whether waiting makes sense for your project, and so you know what to do in the meantime, which is the more useful half.

## What is planned

- **Word frequency and lexical statistics**: what is actually said, and how often, with the usual corrections for corpus size.
- **Co-occurrence and word trees**: which terms travel together, and the contexts a word appears in.
- **Thematic clustering**: grouping statements by lexical similarity, in the tradition of Reinert-style descending classification.
- **Correspondence factor analysis**: positioning speakers, themes and vocabulary on the same map.
- **Charts, word clouds and maps**: for figures you can actually put in a paper.
- **Comparison across interviews**: the point of the whole exercise: what differs between two groups, two waves, two sites.

The order is not fixed, and neither is the list. Ideas from people who do this work daily change it, the feedback button in the app reaches us directly.

## In the meantime

Your corpus is not locked in, and it is already in the right shape for the tools researchers use today:

- **CSV**: one row per segment, with speaker and timing. What R, Python or a spreadsheet expects.
- **Text with normalisation**: the text export can lowercase, strip accents and strip punctuation, which is what [Iramuteq](http://www.iramuteq.org/) and most lexicometric tools want as input.
- **JSON**: the full structured document, for your own pipeline.

See [Export](/docs/transcribe/export). A corpus transcribed and corrected here loses nothing by being analysed elsewhere, and gets analysed here when this section stops saying "coming soon".
