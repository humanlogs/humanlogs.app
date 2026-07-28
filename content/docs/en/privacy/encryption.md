---
title: Encryption and account recovery
description: What end-to-end encryption protects, how keys are handled, and how to get back in.
order: 1
status: live
updated: 2026-07-27
---

End-to-end encryption means your audio and transcripts are encrypted in your browser, before anything is sent to us, and can only be decrypted by you and the people you share with. We store ciphertext and hold no key that opens it.

It is optional, and off unless you turn it on. This page explains what it does so you can decide — and so you can answer an ethics committee that asks.

## The scheme, in plain terms

Each document gets its own random **AES-GCM** key, generated in your browser. That key encrypts the content — the transcript, and the audio file.

The content key is then **wrapped separately for each authorised person**, using their public **RSA** key. The document therefore carries one small encrypted key entry per person with access, alongside one copy of the encrypted content.

Two consequences follow from that design, and they are the reason it is built this way:

- **Sharing is instant and cheap.** Adding someone wraps the content key for them; the transcript itself is not re-encrypted. Sharing a three-hour interview takes the same time as sharing a one-page note.
- **Revoking is exact.** Removing someone deletes their key entry. There is nothing left in the document that their private key can open.

## Where your key lives

When you enable encryption, your browser generates a key pair:

- The **public key** is stored on your account. Others need it to share encrypted documents with you.
- The **private key** never leaves your device. It is stored in your browser's local database, itself encrypted at rest with a device secret.

You also get a **certificate file** to download and keep. It is how you add a second device, and how you recover after clearing your browser data. Keep it somewhere you would keep a password — because that is what it is. See Devices and key recovery.

## What we can and cannot see

With encryption on, we hold: the ciphertext of your transcripts and audio, the wrapped key entries, and the metadata that makes the service work — who owns a document, who it is shared with, its length, when it was created.

We cannot read the transcript or listen to the audio. No support request, no court order and no compromise of our servers changes that, because the key is not ours to produce.

Real-time collaboration works on encrypted documents for the same reason it does not need to be an exception: our server relays messages between collaborators without inspecting them. What it forwards is ciphertext.

## What encryption does not protect

Being precise here matters more than being reassuring:

- **The transcription step.** Speech recognition happens at a provider, which needs the audio in the clear to transcribe it. It is decrypted for that step, under a zero-retention policy, and re-encrypted before storage. If that step is unacceptable for your material, the answer is a local Whisper server on your own infrastructure — see [Self-hosting](/docs/self-hosting/installation-guide).
- **Metadata.** Document names, participants and timing are not encrypted. Do not put a participant's real name in a document title.
- **Anyone you share with.** They can read, export and copy what you gave them access to. Encryption is not a leash.
- **Your own device.** A compromised laptop with your key on it is a compromised transcript.

## The cost

There is exactly one, and it is real: **if you lose your key and your certificate, your content is unrecoverable.** Not by support, not by us. That is the same property that makes the guarantee meaningful.

Download the certificate when you enable encryption, and store it where you will still find it after the thesis.

## Turning it on

Encryption can be enabled during onboarding or later, from **Account → Security**.

Your browser generates a key pair. The public key is stored on your account so others can share encrypted documents with you; the private key stays on your device, encrypted at rest, and never reaches our servers.

You are then offered a **certificate file** containing your key. **Download it and store it somewhere safe** — a password manager, an institutional drive, an encrypted USB stick. It is how you get back in on a new device, and how you recover after clearing your browser data. We cannot recreate it for you: that is the design, and it is the one real cost of encryption.

## What changes day to day

Very little. Documents open, play and export as usual. Two differences are worth knowing:

- Sharing requires the other person to have encryption enabled too — see [Share a document](/docs/organize/collaboration).
- A device without your key shows encrypted documents as locked until you import the certificate.

## Working from a second computer

Sign in on the new device and import your certificate file when prompted. From then on that browser can read your encrypted documents.

## Trust this device

The **trust this device** setting decides whether your key survives logging out.

- **Trusted** — the key stays in this browser, encrypted at rest, so you do not re-import it every session. Right for your own laptop.
- **Not trusted** — the key is wiped on logout. Right for a shared or public machine.

You can change the setting, or remove the key from the current device, at any time from **Account → Security**.

## If a document shows as locked

That browser has no key. Import your certificate, or open the document on a device that already has it.

## If the key is lost

With no certificate and no device holding the key, the encrypted content cannot be recovered — by you or by us. Recover what you can from exports you already produced, and re-transcribe from the original recordings if you still have them.

## Turning it off

Encryption can be disabled from the same screen. Do it deliberately: it is a decision about material you may have promised participants would stay confidential.
