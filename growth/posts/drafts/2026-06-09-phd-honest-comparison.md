# Draft — r/PhD — Comparaison honnête
_Generated: 2026-06-09_
_Format: honest-comparison_
_Status: DRAFT — review before posting_
_Target thread: "My supervisor says Otter.ai isn't GDPR compliant. Is she right?"_

---

TITLE: Your supervisor is right — here's a quick breakdown of what the options actually are

BODY:
Short answer: yes, Otter.ai stores audio on US servers under US jurisdiction. For EU participants, that's a real problem if your IRB/ethics committee requires GDPR compliance.

Here's where the main tools stand:

**Otter.ai** — great product, but US-based, audio stored on US servers, data can be accessed by US authorities under CLOUD Act. Technically non-compliant for GDPR research.

**Rev.com** — same issue, US-based, professional quality but not suitable for sensitive EU data.

**Whisper (local/self-hosted)** — free, open source, runs on your machine so no data leaves your computer. Lower accuracy than cloud tools (~85-90% on accented speech), and you need to handle your own setup.

**Good Tape** — Danish company, EU-based servers, GDPR-compliant, built for journalists and researchers. Good accuracy.

**HumanLogs** — also EU-based, GDPR-compliant, open source (so you can audit the code), has end-to-end encryption option which means even the server doesn't see your audio. Built specifically for interview research.

For most PhD students: if your ethics approval requires GDPR compliance, you want EU-based servers at minimum. If your participants are particularly vulnerable or data is sensitive, the encryption option matters.

What's your institution requiring specifically? Some IRBs just want EU servers, others want a signed DPA, others want full encryption. The answer changes depending on that.

FIRST_COMMENT:
I work on HumanLogs — happy to answer any specific questions about the GDPR side or how we handle data. Link if useful: https://humanlogs.app

---
_HumanLogs URL: https://humanlogs.app_
_First comment strategy: post immediately after the main post_
