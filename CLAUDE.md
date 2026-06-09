# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**humanlogs.app** is a privacy-focused audio transcription web app for research interviews. It is a Next.js 16 (App Router) application running on a **custom Node HTTP server** (`server.ts`) so it can host Socket.io alongside Next. Core capabilities: multi-provider speech-to-text, a collaborative real-time transcript editor (Y.js + TipTap), end-to-end encryption of audio and transcripts, Stripe billing with a credits system, and i18n landing pages. It is open source (AGPL v3) and self-hostable via Docker, but the same codebase runs the hosted SaaS.

## Commands

```bash
npm run dev      # Dev server with hot reload (tsx watch server.ts) on :3000
npm run build    # next build
npm start        # Prod: runs `prisma migrate deploy` then starts server.ts (NODE_ENV=production)
npm run lint     # eslint

# Prisma (uses prisma.config.ts which loads DB url from node-config / DATABASE_URL)
npx prisma migrate dev --name <name>   # Create + apply a migration in dev
npx prisma generate                    # Regenerate client (output: node_modules/.prisma/client)
npx prisma studio                      # Inspect the database

# Docker (full self-host stack incl. postgres)
docker-compose up -d
```

There is **no test suite** in this repo — do not invent test commands. Verify changes by running the app.

## Configuration System (read this before touching anything env-related)

Configuration uses the [`config`](https://github.com/node-config/node-config) (node-config) package, **not** plain `process.env`. Files in `/config`:

- `default.json` — all defaults (committed; contains no real secrets).
- `{NODE_ENV}.json` — environment overrides (e.g. `development.json`, gitignored).
- `custom-environment-variables.json` — maps env vars (e.g. `DATABASE_URL`, `GLADIA_API_KEY`) onto config paths. This is how Docker/env-var deployment overrides config.

Access config through **`lib/config.ts`**, never `config.get()` scattered around:

- `getConfig()` returns the full Zod-validated, type-coerced config (`AppConfig`). Use it in API routes / server components / server-side libs. It strict-parses in production and lenient-parses (`safeParse`) in dev. **Do not call it in `proxy.ts` or anything running in the Edge runtime.**
- Pre-built section exports (`authConfig`, `auth0Config`, `databaseConfig`, `awsConfig`, `sttConfig`, `ldapConfig`) are for convenience and Edge compatibility.
- Note `booleanSchema` in `lib/config.ts`: env vars arrive as strings, so `"false"`/`"0"`/`""` are coerced to `false`. Mirror this when adding new boolean config.

## Architecture

### Custom server & request flow

`server.ts` is the entrypoint (not `next start`). It: installs global crash guards (logs but does not exit on `unhandledRejection`), initializes Socket.io **before** `app.prepare()`, then wires the Next request handler, and initializes cron jobs (`lib/utils/cron-jobs.ts`) in production only.

`proxy.ts` is the Next middleware (Next 16 renamed `middleware` → `proxy`; `middleware.ts.disabled` is the old version kept inert). It runs on the Edge runtime and handles, in order: API request logging, locale routing for landing pages (rewrite to `/en` for SEO, redirect for other locales), Auth0 session middleware (only when `auth.mode === "auth0"`), and security headers (CSP, X-Frame-Options, etc.). Its `matcher` deliberately excludes `/api/transcriptions/create` (the large-upload endpoint).

### Authentication (dual-mode)

Auth has two modes selected by `auth.mode` config (`"auth0"` or `"local"`); `NEXT_PUBLIC_AUTH_MODE` exposes it to the client. **Always go through `lib/auth/auth-helpers.ts`** — `getCurrentUser()` branches between `getLocalSession()` (`lib/auth/local-auth.ts`, bcrypt + session cookie, optional LDAP via `ldapjs`) and Auth0 (`lib/auth/auth0.ts`). It upserts the user into Postgres on every Auth0 login. `requireAuth()` throws `"Unauthorized..."` when there is no session.

### API route convention

API routes live under `app/api/**/route.ts`. Wrap authenticated handlers with **`withAuthRateLimit`** from `lib/router/rate-limit-middleware.ts`, which checks auth, applies per-user rate limiting, and injects the `user` session as the handler's second arg:

```ts
export const GET = withAuthRateLimit(async (request, user) => {
  return NextResponse.json({ userId: user.id });
});
```

Use `withRateLimit` for public-but-throttled endpoints. The rate limiter (`lib/router/rate-limiter.ts`) is backed by the `RateLimit` Prisma model. The 401 mapping happens inside the wrapper, so handlers can let `requireAuth` throw.

### Database (Prisma)

PostgreSQL via Prisma 7 with the **`@prisma/adapter-pg`** driver adapter (see `lib/prisma.ts` — singleton, cached on `globalThis` in dev). Schema in `prisma/schema.prisma`. Key models: `User` (credits/billing/encryption public key/shortcuts), `Project`, `Transcription` (state machine `PENDING → COMPLETED|ERROR`, JSON `transcription` payload, JSON `shared` array for sharing, JSON `audioFileEncryption`), `TranscriptionHistory` (versioning with additions/removals/changed counts), `Feedback`, `DeletionToken`, `RateLimit`, `LandingPageVisit`. Transcription sharing is stored as a JSONB array and queried with **raw SQL `@>` containment** (Prisma can't express it well) — see `app/api/transcriptions/route.ts`.

### Speech-to-text (pluggable providers)

`lib/stt/stt-service.ts` exposes `getSTTService(provider?)` that delegates to one of three clients: `gladia.ts` (default, EU/no-retention), `elevenlabs.ts`, `whisper.ts` (local HTTP server). All clients implement the same async interface (`transcribeFromFileAsync`, `transcribeFromUrlAsync`, `getTranscriptionStatus`). **Provider is inferred from the transcription ID prefix** (`whisper-`, `gladia-`, else ElevenLabs) when polling status. Completion handling and webhook flows live in `lib/stt/transcription-completion.ts` and `app/api/webhook/{gladia,elevenlabs}`. When adding a provider, register it in the config Zod schema, `sttConfig`, the `STTService` switch statements, the ID-prefix routing, and the `isProviderConfigured`/`getAvailableSttProviders` helpers.

**Per-transcription provider selection (data residency):** users have a `dataResidency` preference (`"eu"` → Gladia, `"us"` → ElevenLabs), set during onboarding. The create flow (`app/app/(app)/new/page.tsx`) shows an EU/US selector only when both providers are configured (`getAvailableSttProviders()`, surfaced via `/api/user`), defaulting to the user's `dataResidency` then a remembered localStorage choice. `resolveSttProvider(residencyOrProvider)` maps the request to a configured provider (falling back to `stt.type`), and the chosen provider is persisted on `Transcription.sttProvider`.

### Real-time collaborative editor

The transcript editor is **TipTap** (ProseMirror) bound to a **Y.js** CRDT document, synced over Socket.io — there is no third-party collab server. `lib/sockets/socket-server.ts` (server) keeps in-memory `Map`s of `Y.Doc`, awareness, and a "leader" (single-editor lock) per transcription, broadcasting via Socket.io rooms (`transcription:<id>`, `user:<id>`). Sockets authenticate through `lib/sockets/socket-auth.ts` on connect. Client side: `lib/sockets/socket-client.ts`, `yjs-socket-provider.ts`, and hooks `use-transcription-cursors.ts`. Leadership is claimed/released with a 30s stale threshold and keepalives. **Y.js doc state is in-memory only** — persistence is handled separately by saving the transcription JSON to Postgres.

### End-to-end encryption

Optional client-side E2E encryption so audio/transcripts never reach the server unencrypted. Scheme (documented in `lib/encryption/encryption-entities.ts`): a fresh **AES-GCM** key encrypts the payload, and that AES key is **RSA-OAEP**-wrapped once per authorized user's public key — enabling multi-user sharing without re-encrypting the payload and revocation by removing an entry. There are paired implementations: `*.ts` (Node) and `*.browser.ts` (Web Crypto) — keep them in sync; pick the right one for the runtime. `lib/encryption/encryption.ts` (browser) manages RSA keypair generation, PEM export, and storing the private key **encrypted-at-rest in IndexedDB** under a device secret (with a "trust this device" flag controlling persistence across logout). The user's public key is stored on `User.publicKey`. Audio decryption/conversion happen in the browser (`lib/audio/*.browser.ts`, ffmpeg.wasm).

### Frontend conventions

- App Router with route groups: `app/app/(app)/**` is the authenticated product (transcription editor, account, admin, new); `app/(landing)/[locale]/**` is the localized marketing site; `app/api/**` is the backend.
- Data fetching is **TanStack Query** via hooks in `hooks/` (e.g. `use-api.ts`, `use-transcriptions.ts`); all HTTP goes through `hooks/fetch.ts` (`fetchGateway`). Prefer adding a hook over ad-hoc `fetch`.
- UI is **shadcn/ui** (`components.json`, style `base-nova`, Lucide icons) in `components/ui`; feature components grouped by domain (`components/transcriptions`, `sidebar`, `dialogs`, `encryption`, `welcome`). React 19 with the **React Compiler enabled** (`reactCompiler: true`) — avoid manual `useMemo`/`useCallback` micro-optimizations.
- i18n via **next-intl**: locales `["en","fr","es","de"]` (default `en`) defined in `lib/utils/i18n.ts`; messages split across files (`common`, `dialog`, `editor`, `landing`, ...) under `messages/<locale>/`. Path alias `@/*` maps to the repo root.
- Keyboard shortcuts are user-configurable (`User.shortcuts` JSON, `hooks/use-shortcuts.ts`).

### Storage, billing, email

- `lib/storage.ts` defines a `StorageAdapter` interface with an S3 implementation (AWS SDK v3, presigned URLs) and a local-filesystem fallback for self-hosting. Audio keys are namespaced per user/transcription.
- Billing: `lib/billing/stripe.ts` + `lib/billing/credits-refill-service.ts`; webhooks at `app/api/billing/webhook`. The credits system (`User.credits`/`creditsUsed`/`creditsRefill`) gates transcription minutes (1 credit = 1 minute); refills run via cron.
- Referral program (`lib/referral.ts`): users invite emails (max 10) via onboarding or the referral tab (`app/app/(app)/account/referral`). When an invited email registers a *new* account, `processReferralOnSignup` (wired into both `registerLocal` and the Auth0 first-login path in `auth-helpers.ts`) marks the `Referral` REGISTERED and grants the referrer `REFERRAL_BONUS_CREDITS` (15) immediately plus the same amount monthly via `User.referralBonusCredits` in the refill service. Pending invitations can be removed (frees a slot); `reconcileReferralsForDeletedUser` recomputes a referrer's bonus when a referred user deletes their account (wired into `confirm-deletion`). Invitations are emailed through `lib/email`.
- Email: `lib/email/` supports SMTP (nodemailer) or AWS SES, selected by `email.provider` config.

## Conventions & gotchas

- **TypeScript strict** is on. `@typescript-eslint/no-explicit-any` is **disabled** and `console.log` is allowed; unused vars must be prefixed `_`. Prettier: 2-space indent, no tabs.
- Large uploads: Next is configured for `300mb` body limits (`next.config.ts` `proxyClientMaxBodySize` / `serverActions.bodySizeLimit`); the prod container sets `NODE_OPTIONS=--max-old-space-size=4096` and bundles `ffmpeg`.
- The custom server means changes to `server.ts`, Socket.io handlers, or cron jobs require a full restart, not just HMR.
- Deployment: pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the Docker image and pushes to AWS ECR (→ ECS). Don't push to `main` unless asked.

## Further docs

- `README.md` — features, self-hosting, and the full STT provider comparison/setup (Gladia / ElevenLabs / Whisper).
- `config/README.md` — configuration deep dive.
- `docs/AUTH_SETUP.md`, `docs/LDAP_SETUP.md` — auth provider setup.
