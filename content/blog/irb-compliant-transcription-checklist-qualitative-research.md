---
title: "Is Your Transcription Tool Breaking Your IRB Protocol? The 2026 Compliance Checklist"
date: "2026-06-10"
slug: "irb-compliant-transcription-checklist-qualitative-research"
description: "After the Otter.ai class-action lawsuit and new EU AI Act obligations, IRBs are scrutinizing AI transcription tools. A 12-question checklist to verify your tool is actually compliant, and what to do if it isn't."
author: "HumanLogs Team"
tags: [IRB, GDPR, qualitative-research, compliance, privacy]
---

In August 2025, a class-action lawsuit was filed against Otter.ai alleging the company secretly recorded conversations and used them to train machine learning models without user consent. The case is still active, with a key hearing scheduled for May 2026. Multiple US universities, including Ohio State, issued formal advisories to faculty recommending they stop using Otter.ai for research interviews.

If you're conducting IRB-approved qualitative research and using any cloud-based transcription tool, this matters for you, even if you don't use Otter.ai.

## What changed in 2025 - 2026

Three things happened in quick succession:

**1. The Otter.ai lawsuit made the issue concrete.** Before August 2025, most researchers assumed AI transcription services were covered by standard privacy policies. The Brewer v. Otter.ai complaint made explicit what had been implicit: when you upload interview audio to a cloud service, the service may retain it, analyze it, and train on it. Fireflies.ai faces a separate class-action over biometric voiceprint harvesting under BIPA.

**2. A SAGE Journals editorial explicitly called out qualitative researchers.** In 2025, *Qualitative Inquiry* published a joint editorial arguing that AI transcription of qualitative interviews requires specific informed consent from participants, not just a general consent form. The argument: participants who agreed to be recorded for a research project did not necessarily agree to have their voice data processed by a third-party AI system operating under commercial terms.

**3. The EU AI Act entered its first compliance phase in February 2025.** Layered on top of GDPR, this adds new obligations for AI systems processing personal data, including voice data in transcription. Spain's data protection authority (AEPD) published specific guidance on AI voice transcription in January and again in April 2026. The European Court of Justice ruled in late 2025 that some cloud AI transcription services violate GDPR data minimization principles.

The result: IRBs and ethics committees are now explicitly asking questions about transcription tools that they didn't ask two years ago.

## The 12-question IRB compliance checklist

Use these questions to evaluate any transcription tool before your next IRB submission or renewal. If you can't answer "yes" to questions 1 - 6, there is real compliance risk.

### Data processing and storage

**1. Does the provider have a signed Data Processing Agreement (DPA) available?**
Under GDPR Article 28, any third party processing personal data on your behalf must have a DPA in place. This is non-negotiable for European researchers and increasingly required by US institutions. Many popular tools do not offer a DPA.

**2. Are the servers located in your required jurisdiction?**
For European researchers: data must stay in the EU or a country with an adequacy decision. For US federal research: some grants require US-only processing. Check where audio is stored, not just where the company is headquartered.

**3. Does the provider have a zero data retention policy for audio files?**
Many services retain audio "for service improvement." Your participants' voices should be deleted after transcription is complete. Get this in writing.

**4. Is the audio processed under AES-256 encryption in transit and at rest?**
Standard for HIPAA and increasingly expected by IRBs. Encryption at rest is often absent from cheaper tools.

**5. Does the service train AI models on user-uploaded data?**
This is the Otter.ai issue. Check the Terms of Service specifically, look for language about "improving our services" or "training" that doesn't include an opt-out. If you can't find a clear "no," assume yes.

**6. Is the provider's code open source or independently audited?**
For research involving sensitive populations (clinical, trauma, marginalized communities), some ethics committees now require that privacy claims be independently verifiable, not just asserted in marketing copy.

### Consent and participant protection

**7. Can you describe the full data flow to your IRB?**
Audio → [your device] → [provider servers, location X] → [transcription processed by model Y] → [deleted after Z days]. If any step is unclear, your IRB may reject the protocol.

**8. Does your participant consent form mention the transcription tool specifically?**
Per the SAGE editorial, participants should be informed their voice will be processed by a named third-party AI system. Generic "your responses will be kept confidential" language may no longer be sufficient.

**9. Does the provider's data processing comply with the legal basis you've claimed in your IRB protocol?**
If your legal basis is "legitimate interests," the provider must not override that with commercial interests in the data. If it's "consent," that consent must extend to the sub-processor.

### Research-specific functionality

**10. Does the provider support speaker diarization with sufficient accuracy for your study design?**
Speaker misattribution, the system labeling a quote under the wrong participant, can invalidate entire coding sequences. Test on a sample of your actual recordings before committing.

**11. Does the export format work directly with your qualitative analysis software?**
Reformatting a plain-text transcript for NVivo, MAXQDA, or Atlas.ti can add hours. The tool should preserve speaker labels and timestamps in a format the QDA software can import cleanly.

**12. Can you get a written statement from the provider confirming compliance with your specific requirements?**
For high-risk research (clinical, HIPAA-covered, EU-based), your IRB may require written documentation that your tool meets their standards. Many popular services cannot or will not provide this.

## How popular tools score

| Tool | DPA available | EU servers | Zero training | Open source |
|------|--------------|------------|---------------|-------------|
| Otter.ai | Limited | No (US) | No (lawsuit) | No |
| Fireflies.ai | Limited | No (US) | No (BIPA case) | No |
| Descript | No | No (US) | Unclear | No |
| Rev | Yes (enterprise) | No (US) | Unclear | No |
| Sonix | Yes (enterprise) | No (US) | Unclear | No |
| HumanLogs | Yes | Yes (EU) | Yes | Yes (AGPL v3) |
| aTrain (local) | N/A | Local only | Yes | Yes |

*Note: this reflects publicly available information as of June 2026. Policies change; always verify directly.*

**aTrain** is worth mentioning: it's an open-source local transcription tool that runs entirely on your machine. If your institution blocks all cloud transcription or you're working with extremely sensitive data, it's a valid option, though it requires technical setup and a capable GPU.

## What to do if your current tool fails the checklist

**If you're mid-study:** Don't switch tools mid-collection without notifying your IRB. Many boards will accept an amendment if you switch to a more compliant tool, especially if you frame it as a protective measure.

**If you're writing a new protocol:** Specify the tool by name in your data management plan, include the DPA as an appendix, and explicitly state in the consent form that voice data will be processed by the named tool and deleted after transcription.

**If your institution has issued a warning:** Take it seriously. Ohio State's advisory cited specific FERPA and HIPAA risks. If your IRB later discovers you used a tool your institution warned against, it can affect your study approval retroactively.

**If you work with EU participants:** The GDPR DPA requirement is not optional. The AEPD guidance (April 2026) and ECJ ruling have made EU-based data residency effectively mandatory for GDPR compliance with voice data. Check your tool's sub-processors list, even "EU-compliant" tools often route processing through US-based model providers.

## The case for end-to-end encryption

Most tools stop at encryption in transit and at rest, meaning the provider can still read your audio on their servers. End-to-end encryption means the audio is encrypted on your device before upload, using a key only you hold. The server processes an encrypted blob it cannot read.

This architecture means that even if a provider is served a subpoena or suffers a data breach, your participants' audio is not exposed. For clinical research, trauma research, or any study where participant identity could cause harm, this is worth the marginal setup complexity.

HumanLogs was built with this architecture as the default option: client-side encryption with AES-GCM, RSA-OAEP key wrapping, and private keys that never leave your device. It also runs on EU servers, offers a signed DPA, has a zero-retention audio policy, and the source code is publicly auditable on GitHub.

---

*The right time to review your transcription tool's compliance is before your IRB submission, not after a rejection. If you have questions about documentation for your specific study design, [contact us](/contact) or read our [IRB compliance documentation guide](/use-cases/research).*
