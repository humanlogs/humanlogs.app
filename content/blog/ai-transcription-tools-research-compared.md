---
title: "AI Transcription Tools for Research Compared: Otter.ai, Whisper, Gladia, and More (2026)"
date: "2026-06-11"
slug: "ai-transcription-tools-research-compared"
description: "A practical comparison of Otter.ai, Whisper, Gladia, Rev, and HumanLogs for PhD students and qualitative researchers, accuracy on real interview audio, GDPR compliance, pricing, and QDA software compatibility."
author: "HumanLogs Team"
tags: [transcription, qualitative-research, research, GDPR, productivity]
---

Every few months a thread appears on r/PhD asking which transcription tool people actually use, and every time, it gets hundreds of responses. Some people swear by Otter.ai. Others insist on running Whisper locally. A few mention tools that most readers have never heard of.

The reason these threads keep happening is that most comparison articles are written for business use cases (meetings, note-taking) and miss the specific requirements of interview research: accuracy on conversational audio with non-native speakers, compliance with IRB and GDPR requirements, and output formats that work with NVivo, Atlas.ti, or MAXQDA.

This is that comparison, written specifically for researchers.

## What research transcription actually requires

Before the tools: here's what makes interview research different from transcribing a meeting.

**Accuracy on difficult audio.** Research interviews happen in imperfect conditions, participants speak with accents, hesitate, trail off, talk over each other. "95% word error rate" benchmarks are typically measured on clean, standard-accent studio audio. The tools vary enormously when you test them on a real 45-minute interview recorded on a laptop microphone in a participant's kitchen.

**Speaker diarization you can trust.** Speaker misattribution, the system assigning a quote to the wrong participant, is not just an annoyance. In qualitative analysis, attributing a quote to the wrong person can distort coding and invalidate findings. Good diarization matters.

**Compliance documentation.** Your IRB or ethics committee cares where the audio goes, who can access it, and whether the provider trains models on your data. "We use industry-standard security" is not a sufficient answer.

**Cost at research scale.** Sixty hours of interview audio is not unusual for a PhD thesis. Cost-per-minute differences that seem minor add up significantly at that scale.

**QDA software compatibility.** The best transcription is useless if you spend two hours reformatting it to import into NVivo. Timestamps and speaker labels need to survive the export.

## The tools

### Otter.ai

The most widely-known name in AI transcription, and the one that comes up most often in researcher forums.

**Accuracy:** Strong on clear English, noticeably worse on accented speech and technical vocabulary. In informal testing on interview audio with non-native English speakers, accuracy drops to the low-to-mid eighties. Diarization is generally good when speakers have distinct voices and microphone channels.

**Privacy and compliance:** This is where researchers need to pause. Otter.ai is a US company with servers in the US. Audio uploaded by EU researchers is processed under US jurisdiction, including the CLOUD Act, which allows US law enforcement to request data from US companies regardless of where the data subject is located. Otter.ai does not offer a Data Processing Agreement (DPA) on standard or Pro plans. In August 2025, a class-action lawsuit (*Brewer v. Otter.ai*) alleged the company used uploaded audio to train machine learning models without user consent. The case is ongoing. Multiple US universities, including Ohio State, issued advisories recommending researchers stop using Otter.ai for IRB-approved studies.

**Pricing:** Free tier (600 minutes/month), Pro at $16.99/month (1,200 minutes), Business at $30/month.

**QDA export:** Plain text or .docx with speaker labels. No structured export with inline timestamps. Getting timestamps per line requires manual work or third-party conversion scripts.

**Verdict:** Good product for its intended use case (meeting notes, personal productivity), but not suitable for EU/GDPR research and carries real risk for US-based research under current IRB scrutiny.

---

### Whisper (self-hosted via OpenAI's open-source model)

OpenAI released Whisper as open-source in 2022 and it remains the standard comparison point for accuracy benchmarks.

**Accuracy:** Excellent, particularly on accented speech and non-English languages. For many researchers working with minority languages or thick regional accents, Whisper is the only option with acceptable accuracy. The large-v3 model is the current best version.

**Privacy:** Because you run it locally, nothing leaves your machine. This is the strongest possible privacy posture, no third party sees your audio.

**Practical limitations:** Running Whisper meaningfully fast requires a GPU with at least 8GB VRAM. On a MacBook Air M2, transcribing one hour of audio takes approximately 20 - 25 minutes (tolerable). On a CPU-only Windows laptop, the same job can take 2 - 3 hours. Speaker diarization requires a separate library (pyannote.audio) with its own setup and licensing requirements.

**Pricing:** Free (compute costs only).

**QDA export:** Raw text or JSON output with timestamps. Speaker labels depend on your diarization pipeline configuration. Usable but requires some technical work to get clean output for NVivo/Atlas.ti.

**Verdict:** The gold standard for privacy-sensitive transcription if you're comfortable with command-line tools. Not practical for researchers without technical background or access to capable hardware.

---

### Gladia

Gladia is a French AI company offering a transcription API built on Whisper-class models, with EU data residency.

**Accuracy:** Competitive with Whisper large on most languages. Strong speaker diarization, including code-switching (participants switching languages mid-interview). Word-level timestamps.

**Privacy and compliance:** Servers in the EU. No audio retention after processing. DPA available. The company explicitly targets research and medical use cases in their documentation.

**Pricing:** API access billed per hour of audio, approximately $0.54/hour. No monthly subscription, you pay for what you use.

**QDA export:** JSON and SRT formats with speaker labels and timestamps. Not a direct NVivo importer but structured enough to convert with minimal effort.

**Practical note:** Gladia is an API, not an end-user product. You either need to use it through a tool that integrates it (like HumanLogs) or write your own integration code.

**Verdict:** Strong technical choice for EU-based researchers or anyone with API integration capability. Not a standalone tool.

---

### Rev

Rev is the professional transcription service, both human and AI options, that has been around the longest.

**Accuracy:** The AI product is competitive. The human transcription option consistently outperforms all AI options on difficult audio (strong accents, technical jargon, multiple overlapping speakers). Human transcription is the only option some IRBs will accept for sensitive studies.

**Privacy:** US-based, US servers. Enterprise plan includes a DPA. Standard plans do not. Not suitable for EU participants under GDPR without the enterprise agreement.

**Pricing:** AI transcription $0.25/minute, human transcription $1.50/minute. At 60 hours, AI alone runs $900; human runs $5,400.

**QDA export:** Structured .docx and .txt with speaker labels. Rev's human transcription format is specifically designed for research and can be imported into most QDA software.

**Verdict:** Best option when accuracy is critical and cost is not the constraint, or when human review is specifically required. Not economical for typical PhD research volumes.

---

### Good Tape

Good Tape is a Danish company that built a transcription tool specifically for journalists and researchers.

**Accuracy:** Solid on major European languages. Less strong than Gladia or Whisper on accented or non-standard speech.

**Privacy:** EU-based (Denmark). GDPR-compliant. Audio is deleted after transcription. DPA available.

**Pricing:** €10/month for 200 minutes, €20/month for 500 minutes.

**QDA export:** Text export with speaker labels. Limited structured format options.

**Verdict:** A practical EU-compliant option for researchers who want a simple product without API integration. Limited feature set compared to research-focused tools.

---

### HumanLogs

Full disclosure: this is our own tool. We've included it because researchers keep asking us how it compares.

**Accuracy:** Uses Gladia (EU-based) and ElevenLabs Scribe as backends, selectable per study based on data residency requirements. Accuracy is equivalent to those underlying models, 95 - 98% on clean audio, slightly lower on difficult conditions.

**Privacy:** EU servers, zero audio retention, DPA available, open-source code auditable on GitHub (AGPL v3). Optional end-to-end encryption: audio is encrypted on your device before upload using AES-GCM with RSA-OAEP key wrapping, so the server processes an encrypted blob it cannot read. This means even a server breach or legal subpoena cannot expose your participants' audio.

**Pricing:** Credit-based system (1 credit = 1 minute of audio). Free tier available; paid credits can be purchased or earned via referrals.

**QDA export:** Transcript editor with clickable timestamps synced to audio. Text export preserves speaker labels and timestamps. Not yet a direct import format for NVivo/MAXQDA, plain text with speaker labels that requires minor reformatting.

**Verdict:** Best fit for EU-based research or any study where privacy documentation matters (sensitive populations, clinical research, trauma studies). The E2E encryption option is, as far as we know, unique in this category of tools.

---

## Summary comparison

| Tool | Accuracy | EU-compliant | No model training | DPA | Free tier | Self-hostable |
|------|----------|-------------|-------------------|-----|-----------|---------------|
| Otter.ai | Good (EN) | No | No (lawsuit) | No | Yes | No |
| Whisper (local) | Excellent | N/A | Yes | N/A | Yes | Yes |
| Gladia | Excellent | Yes | Yes | Yes | No | No |
| Rev (AI) | Good | No | Unclear | Enterprise only | No | No |
| Good Tape | Good | Yes | Yes | Yes | No | No |
| HumanLogs | Excellent | Yes | Yes | Yes | Yes | Yes |

*Reflects publicly available information as of June 2026. Verify directly before making IRB submissions.*

---

## Testing on your own audio

Benchmarks from controlled datasets don't predict how a tool will perform on your recordings. Before committing to a tool for a full study, spend an hour on an accuracy test:

1. Take 10 minutes from an actual interview (or a representative pilot recording).
2. Create a ground-truth transcript by hand or with careful correction.
3. Run the same audio through each tool you're evaluating.
4. Count the word error rate on the hard parts: the first 60 seconds when the participant is warming up, any passage with technical vocabulary, any moment with interruptions.

The differences between tools become much clearer on the passages that matter for your analysis than they do on average accuracy scores.

## What about cost at scale?

A typical PhD dissertation with 20 interviews of 60 minutes each, a common design, means 20 hours of audio. Here's what that costs across tools:

| Tool | 20 hours | 60 hours |
|------|----------|----------|
| Otter.ai Pro | ~$17/month | ~$17/month (limit is 1,200 min/month, so ~3 months) |
| Whisper (local) | $0 | $0 |
| Gladia | ~$10.80 | ~$32.40 |
| Rev (AI) | $300 | $900 |
| Good Tape | ~$20/month | ~$20 - 40/month |
| HumanLogs | Free tier / low credits | Moderate credits |

The cost gap between self-hosted/EU-compliant options and professional human transcription is enormous. For most PhD students, the decision is between "free but complex" (Whisper), "low cost and EU-compliant" (Gladia/HumanLogs), and "familiar but risky" (Otter.ai).

## The compliance question is separate from the accuracy question

The strongest accuracy doesn't help you if your IRB rejects your data management plan. The most compliant tool doesn't help you if your transcripts need three hours of correction.

The practical recommendation for most EU-based qualitative researchers: use a GDPR-compliant tool (Good Tape, HumanLogs, or Gladia via a compatible front-end) and test it on pilot recordings before committing. For US-based researchers: verify your institution's current advisory status on Otter.ai and Fireflies.ai before beginning data collection.

If you want a checklist of what your IRB is likely to ask about your transcription tool, we've written a detailed walkthrough in our [IRB compliance guide](/blog/irb-compliant-transcription-checklist-qualitative-research).
