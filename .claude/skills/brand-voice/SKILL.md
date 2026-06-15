---
name: brand-voice
description: Brand voice guide for HumanLogs — audience, language, tone, product facts and CTA rules. Read this before writing ANY content published under the HumanLogs name (blog articles, social posts, emails, landing copy), typically together with the daily-blog skill.
allowed-tools: Read
---

# HumanLogs — brand voice

How to sound like HumanLogs when writing public content.

## Product facts (never invent beyond these)

- **HumanLogs** (https://humanlogs.app) is a fast, confidential transcription
  app for research interviews. Core capabilities: highly accurate AI
  speech-to-text in 100+ languages (≈2h of audio processed in ~10 min), a
  unique audio-based editor (click any word to jump to that moment in the
  recording) that helps refine transcripts ~4x faster, real-time
  collaboration, automatic speaker diarization with manual labelling, project
  organisation, and exports to PDF, Word, CSV and TXT.
- **Privacy is the differentiator**: optional **end-to-end encryption** means
  audio and transcripts never reach the server unencrypted — the user holds
  the keys. The default cloud provider (Gladia) runs on European servers in
  no-training, no-retention mode.
- It is **open source** (AGPL v3, https://github.com/humanlogs/humanlogs.app)
  and **self-hostable** via Docker, including on a university's own
  infrastructure. Customer data is exportable.
- Pricing: a **free plan** (100 minutes/month, ~3 transcriptions, no credit
  card), **paid plans starting at $15/month** for more minutes, free
  self-hosting (bring your own ElevenLabs or Whisper API key), and custom
  enterprise plans. All plans include all features. For exact tiers, check the
  pricing page rather than inventing numbers.
- Do not invent other features, prices, integrations or legal claims. When in
  doubt about a product capability, check the landing pages under
  `app/(landing)/[locale]/` or leave it out.

## Audience & language

- Write for **researchers and the people around qualitative research**: PhD
  students, academic and qualitative researchers, journalists, educators,
  podcasters, and research teams at universities. They handle sensitive
  interview data, care about accuracy and confidentiality, and are short on
  time — not technical experts.
- Default to **English**, the primary language of the site. When writing for a
  specific locale (the app also ships `fr`, `es`, `de`), write natively in
  that language — don't translate stiffly.
- Sign content as the **HumanLogs Team** (e.g. `author: "HumanLogs Team"` in
  blog frontmatter).

## Tone

- Clear, concrete, helpful. Short sentences. Explain methodology or technical
  terms the first time they appear (e.g. verbatim, diarization, IRB,
  end-to-end encryption).
- No fluff, no grandiose openers ("in a world where…"), no empty
  superlatives.
- Be useful first: the reader should get real, methodologically sound answers
  even if they never try the product. Respect the rigour of academic work.

## Product mentions & CTA

- Mention HumanLogs where it genuinely helps the reader, typically in a
  closing section that connects the topic to the product (fast accurate
  transcription, the audio-based editor, speaker labels, collaboration,
  privacy / end-to-end encryption, open source / self-hosting for
  universities).
- Stay factual and low-pressure — position on privacy, accuracy, speed,
  control and openness (encryption, data portability, self-hosting), never by
  disparaging competitors with invented claims.
