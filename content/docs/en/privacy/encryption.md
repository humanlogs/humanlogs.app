---
title: Encryption and account recovery
description: What end-to-end encryption protects, how the keys are handled, and how to get back in on a new device.
order: 1
status: live
updated: 2026-07-28
related: organize/collaboration, privacy/legal
---

End-to-end encryption means your transcripts and your audio are stored encrypted with a key only you hold, and can only be read by you and the people you share with. We store ciphertext and hold no key that opens it.

It is optional, and off unless you turn it on. This page explains what it does, so you can decide, and so you can answer an ethics committee that asks about it.

## Turning it on

From **Account → Security**, or during onboarding.

Your browser generates a key pair. The **public key** is stored on your account, because others need it to share encrypted documents with you. The **private key** never leaves your device: it lives in your browser's local database, itself encrypted at rest with a device secret.

You are then offered a **certificate file** containing your key. **Download it and keep it somewhere safe**, a password manager, an institutional drive, an encrypted USB stick. It is how you get back in on another device, and how you recover after clearing your browser data. We cannot recreate it for you.

## The scheme, in plain terms

Each document gets its own random **AES-GCM** key, which encrypts its content: the transcript, the audio file, the speaker list and the vocabulary.

That content key is then **wrapped separately for each authorised person**, using their public **RSA** key. A document therefore carries one small encrypted key entry per person with access, alongside a single copy of the encrypted content.

Two consequences follow, and they are the reason it is built this way:

- **Sharing is instant.** Adding someone wraps the content key for them; the transcript itself is not re-encrypted. Sharing a three-hour interview takes as long as sharing a one-page note.
- **Revoking is exact.** Removing someone deletes their key entry. Nothing is left in the document that their private key can open.

## What changes day to day

Very little. Documents open, play and export as usual. Exports are produced in your browser from the decrypted document, so the clear text never comes back to us.

Two differences are worth knowing:

- Sharing requires the other person to have encryption enabled too, otherwise there is no key to encrypt for. Sharing is refused with an explicit message. See [Collaboration](/docs/organize/collaboration).
- A device without your key shows encrypted documents as locked until you import your certificate.

## Working from a second device

Sign in on the new device and import your certificate file when prompted. From then on, that browser can read your encrypted documents.

The **trust this device** setting decides whether the key survives logging out:

- **Trusted**: the key stays in this browser, encrypted at rest, so you do not re-import it every session. Right for your own laptop.
- **Not trusted**: the key is wiped on logout. Right for a shared or public machine.

You can change that setting, or remove the key from the current device, at any time from **Account → Security**.

## Recovering access

**A document shows as locked**: that browser has no key. Import your certificate, or open the document on a device that already holds it.

**You lost the certificate but still have a device that works**: download a fresh copy from **Account → Security** on that device, and store it properly this time.

**The document says the certificate does not match**: it was encrypted with a different key: an older certificate of yours from before an encryption reset, or someone else's. Importing the original certificate is the only way in; if it is gone, the document can only be deleted.

**You lost the certificate and every device**: the encrypted content cannot be recovered, by you or by us. Recover what you can from exports you already produced, and re-transcribe from the original recordings if you still have them.

That last case is the one real cost of encryption, and it is the same property that makes the guarantee worth anything.

## What we can and cannot see

Encrypted, unreadable to us: the transcript, the audio, the speaker names, your codes and their labels, comments, and the custom vocabulary you gave the recording.

In clear, because the service cannot work otherwise: the document title, the original file name and size, the language, durations and dates, who owns a document and who it is shared with. Code identifiers are stored too, but they are meaningless uuids, the labels live inside the encrypted payload.

That is why the advice about titles below matters: it is the one field where you choose what we can see.

We cannot read the transcript or listen to the audio. No support request, no court order and no compromise of our servers changes that, because the key is not ours to produce.

Real-time collaboration is not an exception: our server relays messages between collaborators without inspecting them, and what it forwards is ciphertext.

## What encryption does not protect

Being precise here matters more than being reassuring:

- **The transcription step.** Speech recognition happens at a provider, which needs the audio in the clear. It is decrypted for that step, under a zero-retention policy, and re-encrypted before storage. If that is unacceptable for your material, run a local Whisper server on your own infrastructure. See the [installation guide](/docs/self-hosting/installation-guide).
- **The upload itself.** Your audio reaches us in the clear and is encrypted on arrival, with a key only you can unwrap. It has to: the transcription provider needs to hear it. Encryption protects it at rest, from that moment on, which is what a stolen backup or a compromised database would touch.
- **Document titles.** They stay readable, so do not put a participant's real name in one. Their names inside the transcript, the speaker list and the vocabulary are encrypted.
- **Anyone you share with.** They can read, export and copy what you gave them. Encryption is not a leash.
- **Your own device.** A compromised laptop holding your key is a compromised transcript.

## Turning it off

Encryption can be disabled from the same screen. Do it deliberately: it is a decision about material you may have promised participants would stay confidential.
