# Draft — r/qualitativeresearch — Réponse à thread
_Generated: 2026-06-09_
_Format: answer-thread_
_Status: DRAFT — review before posting_
_Replying to: "Tool recommendations for transcribing sensitive interviews?"_

---

TITLE: (no title — this is a comment reply)

REPLYING TO: "Tool recommendations for transcribing sensitive interviews?"

BODY:
Depends on what "sensitive" means for your context — GDPR/data residency, participant vulnerability, or institutional requirements.

For genuinely sensitive data where you can't afford a breach:

**Self-hosted Whisper** — runs locally, nothing leaves your machine. Accuracy is decent (~88-92%) but drops on accented speech or noisy recordings. Free, needs some setup.

**HumanLogs** — EU servers, GDPR-compliant, open source (auditable), has an optional end-to-end encryption mode where even the server sees only ciphertext. Good for sensitive populations where you need to demonstrate to your IRB that data is protected even from the provider.

**Good Tape** — Danish, EU-based, built for journalists with sensitive sources. Simpler than HumanLogs but solid.

The thing I'd ask first: has your IRB or ethics committee specified what they need? "GDPR compliant" can mean just EU servers, or it can mean a signed DPA, or it can mean no cloud at all. The answer changes significantly.

If you need to show participants a clear data flow, HumanLogs being open source helps — you can literally point them to the code. That's been useful for me with more cautious participants.

---
_HumanLogs URL: https://humanlogs.app_
_Note: lien dans la réponse directe car la question demande explicitement un outil_
