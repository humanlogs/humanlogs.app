---
title: Installation guide
description: Requirements, Docker install, configuration, speech-to-text providers, authentication, backups.
order: 1
status: live
updated: 2026-07-28
related: privacy/encryption, privacy/legal
---

HumanLogs is AGPL v3 and self-hostable: the hosted service and your own install run the same code. Nothing is metered when you host it yourself, you bring your own speech-to-text provider and pay them directly. If you need different licence terms, a commercial licence is available: [contact us](/contact).

This page is the operator's overview. The repository holds the detail, next to the code it configures, so it cannot drift: [github.com/humanlogs/humanlogs.app](https://github.com/humanlogs/humanlogs.app).

## Requirements

- **Docker and Docker Compose**: or a Node.js 20+ host to run it directly.
- **PostgreSQL**: the compose file includes one.
- **A speech-to-text provider**: an API key for a hosted provider, or a local Whisper server if the audio must never leave your network.
- **Storage**: an S3-compatible bucket, or the local filesystem for a small install.
- **SMTP or AWS SES** for transactional email.

Transcription runs on the provider, so the app is not CPU-hungry except for audio conversion, which is why the container ships `ffmpeg` and raises Node's heap. Plan disk for the audio you keep: that, not CPU, is what grows.

## Install

```bash
git clone https://github.com/humanlogs/humanlogs.app.git
cd humanlogs.app
docker-compose up -d
```

This builds the image and pulls PostgreSQL. Database migrations run on startup, so there is no separate install step.

Before opening it to users, set the environment variables in `docker-compose.yml`: at minimum a session secret, database credentials, a speech-to-text API key and your public URL.

## Configuration

Configuration uses [node-config](https://github.com/node-config/node-config) rather than reading environment variables directly, which is what makes one image work on a laptop and in production.

- `config/default.json`, every default. Committed, no real secrets.
- `config/{NODE_ENV}.json`, per-environment overrides, not committed.
- `config/custom-environment-variables.json`, maps environment variables onto config paths. This is how a container deployment overrides anything.

Environment variables arrive as strings: `false`, `0` and an empty value are all treated as false. `config/README.md` documents every key.

## Speech-to-text providers

Three are supported, and you can configure more than one.

| Provider | Where | Notes |
| --- | --- | --- |
| **Gladia** | EU | Zero retention. What EU residency uses on the hosted service. |
| **ElevenLabs** | US | Zero retention, no per-file duration limit. |
| **Whisper** | Your infrastructure | whisper.cpp, the ASR webservice image, or faster-whisper. |

A local Whisper server is often the deciding argument for an institutional install: the audio never leaves your network, so the [one gap in end-to-end encryption](/docs/privacy/encryption) closes. Accuracy and speed then depend on the model size and whether you have a GPU.

When two providers are configured, users get the EU/US choice on each upload; with one, the selector disappears. The provider used is stored on each document. The README documents the variables and the Docker commands for each Whisper flavour.

## Authentication

- **Local**: email and password, hashed in your own database, with a session cookie. The default for self-hosting.
- **Auth0**: delegate sign-in when you already run SSO. Users are created in the database on first login.
- **LDAP**: local mode can authenticate against an LDAP directory, so lab members sign in with institutional credentials.

Step-by-step setup lives in `docs/AUTH_SETUP.md` and `docs/LDAP_SETUP.md` in the repository.

## Storage and email

Audio is written through a storage adapter with two implementations: **S3-compatible** (AWS S3, MinIO, anything compatible) with presigned URLs, and the **local filesystem** for small installs. Remember it then becomes part of what you back up. Keys are namespaced per user and per document.

Email goes over **SMTP** or **AWS SES**. It is not optional in practice: transcription-ready notifications, referral invitations and account-deletion confirmations all go through it. An instance with no working email is one where users cannot delete their own account.

## Upgrades

Pull the new image and restart; migrations are applied automatically. Take a database backup first anyway: migrations are one-way.

## Backups

- **PostgreSQL**: accounts, documents, transcripts, sharing. Everything except the audio.
- **Audio storage**: your bucket, or the local directory.

Both, or neither: a database without its audio leaves documents that cannot be replayed.

If your users enabled end-to-end encryption, your backups contain ciphertext. That is good for confidentiality and unforgiving for recovery, no key you hold restores their content, so make sure they keep their certificate.

## Contributing

`npm run dev` runs it locally; `npm test` and `npm run test:e2e` run the suites, neither of which needs Docker or an external service. Coverage is concentrated on the collaborative editor (protocol, convergence, encryption, sharing permissions) because that is where breakage is silent. `docs/TESTING.md` explains what each suite covers.
