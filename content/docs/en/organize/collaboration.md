---
title: Collaboration
description: Give someone access, choose what they can do, and work at the same time.
order: 2
status: live
updated: 2026-07-28
related: organize/comments, privacy/encryption
---

Sharing is per document and by email address: the person must have an account on the same instance, and there is no public link. For research material that is a feature, a transcript is never one forwarded URL away from being readable by anyone.

## Share it

Open **Share** from the document actions, enter the person's email, pick a role, and add them. They see the document immediately, in their **Shared with me** section.

If the address matches no account, you are told so rather than left waiting: ask them to create an account first.

## The three roles

| Role | Read the transcript | Listen to the audio | Edit |
| --- | --- | --- | --- |
| **Read** | Yes | No | No |
| **Read + Listen** | Yes | Yes | No |
| **Write** | Yes | Yes | Yes |

**Read** without the audio is the role that matters most often and is easy to miss. A transcript can be anonymised; a voice cannot. Giving a research assistant, a co-author or an external reviewer the text without the recording is frequently exactly what your ethics protocol requires, and it is one click.

**Read + Listen** is for someone who has to verify what was actually said: a translator, a second coder, a supervisor checking a contested passage.

**Write** is for people correcting the transcript with you. They can edit the text, rename speakers and comment.

Anyone with access can comment and be mentioned, whatever their role.

## Roles are enforced, not suggested

The role is checked on the server on every operation, not just reflected in the interface. Someone with read access cannot write to the document by manipulating their browser, and someone with read-only access never receives the audio at all.

The document identifier is not a secret, it travels in URLs and exports, which is precisely why access is decided by the sharing list and nothing else.

## Changing or removing access

The same dialog lists everyone with access. Change a role at any time, or **revoke access** to remove someone entirely, effective immediately. On an encrypted document, revoking also removes their key entry, so they cannot decrypt anything from then on.

## Transferring ownership

The owner can hand a document to another collaborator. After the transfer they become the owner and you keep write access; only they can hand it back. It is the right move when a student leaves the lab, or when a document created in a personal account should belong to whoever now runs the study.

Owners are the only ones who can delete a document, transfer it or manage access. Everything else depends only on the role each person was given.

## Encrypted documents

If the document is end-to-end encrypted, the person you share with must have encryption enabled on their own account, otherwise there is no key to encrypt it for. Sharing is refused with an explicit message when that is the case.

## Working at the same time

Several people with write access can edit simultaneously: you see each other's cursors and selections where they are working, and changes appear as they are typed. There is no "who has the file" problem, everyone converges on the same text.

The editor tells you when your connection drops and keeps working locally, syncing when you come back. On an encrypted document this works unchanged: what travels through our server is ciphertext.
