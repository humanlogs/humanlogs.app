# Testing

Two runners, deliberately split by what they can protect:

| Command             | Runner     | Covers                                                                 | Duration |
| ------------------- | ---------- | ---------------------------------------------------------------------- | -------- |
| `npm test`          | Vitest     | pure logic + the collaboration protocol (real Socket.io, real Y.Docs)  | ~15 s    |
| `npm run test:e2e`  | Playwright | two real browsers editing one transcript through the whole app         | ~1.5 min |

Both run in CI on every pull request (`.github/workflows/ci.yml`), alongside
`npm run lint` and `npm run typecheck`. Neither needs Docker, a database server
or any API key.

## Why collaboration gets this much attention

The collaborative editor is the part of the app where a regression is both most
likely and least visible: it only misbehaves with *several* clients, often only
under a specific join order or timing. The suites are organised around the ways
it can silently break.

## `npm test` — Vitest

```bash
npm test              # once
npm run test:watch    # watch mode
npm test -- doc-to    # a single file
```

### `tests/unit` — pure functions

- **`doc-to-segments.test.ts`** — the keystone of the editor. The Y.Doc carries
  text and structure only; every client must *derive* the same per-word audio
  timestamps from (converged document + shared timing reference). These tests pin
  that it is a pure, deterministic, order-independent function, that refreshing
  the shared reference is a fixed point (no drift over a long session), and that
  it stays fast on a 3000-word transcript.
- **`yjs-codec.test.ts`** — the transport codecs, including the AES-GCM one used
  for end-to-end-encrypted transcripts: exact binary round-trips, fresh IV per
  message, tampered and wrong-key payloads rejected.
- **`transcription-access.test.ts`** — the full sharing permission matrix
  (`read` < `read+listen` < `write`), including malformed share data.

### `tests/integration` — the real protocol

These start the app's **actual Socket.io server** on an ephemeral port, connect
**real socket.io clients** with **real JWT socket tokens**, and drive **real
Y.Docs** through the app's own provider. Only the database is stubbed.

- **`collab-relay.test.ts`** — handshake rejection, seeding authority, late
  joiners pulling full state, convergence under concurrent edits (2 and 3
  clients), authority hand-off when the leader leaves, single-save-leader
  invariant, room isolation, remote carets appearing and disappearing.
- **`collab-e2e-encryption.test.ts`** — with an encrypted transcript, an
  eavesdropping socket in the same room must only ever observe ciphertext, and a
  peer holding the wrong key (or none) must be unable to read the document.
- **`shared-transcriptions.db.test.ts`** — runs against a real PostgreSQL for the
  raw JSONB containment query behind "shared with me".

## `npm run test:e2e` — Playwright

```bash
npm run test:e2e            # headless
npm run test:e2e:ui         # interactive
npx playwright show-report  # last HTML report
```

`tests/e2e/serve.ts` boots the database and the app's real custom server
(`server.ts`, so Socket.io behaves exactly as in production); Playwright waits
for it and then drives two browser contexts. Accounts and transcripts are created
through the app's own public API, so the setup path is covered too.

`tests/e2e/collaboration.spec.ts` covers: both participants seeing a shared
transcript, edits flowing each way, concurrent typing converging character for
character, a late joiner receiving edits that were never saved, remote carets,
persistence through the save leader, a read-only participant being unable to type
or delete (locally *or* for anyone else), and a stranger getting a 403.

If your environment ships its own Chromium instead of the build Playwright
downloads:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npm run test:e2e
```

## The test database

Tests that need PostgreSQL use **PGlite** — real PostgreSQL compiled to WASM,
running in-process — exposed on a TCP socket so the app's own
`@prisma/adapter-pg` connects to it unchanged. The schema is applied with
`prisma db push`, which is enough for a disposable database: no migration history
to replay.

**Why not SQLite**, which would look like the simpler choice? The schema and the
queries are Postgres-specific in ways that are not worth degrading for tests:

- Prisma does not support `enum` types or scalar lists (`vocabulary String[]`) on
  SQLite;
- sharing is queried with JSONB containment (`shared @> …`), which has no SQLite
  equivalent.

Testing on SQLite would mean testing a *different* schema than the one that runs
in production — the suite would stay green while sharing broke. PGlite keeps the
zero-setup ergonomics without that trade-off (~5 s to boot and push the schema).

## Adding tests

- A **pure** function (projection, permissions, codecs) → `tests/unit`.
- Something that depends on **several clients talking to each other** →
  `tests/integration`, using `tests/integration/helpers/collab-harness.ts`
  (`startCollabServer`, `joinCollab`, `waitFor`, `settle`).
- Something that depends on the **editor, the DOM or a real session** →
  `tests/e2e`, using the fixtures in `tests/e2e/fixtures.ts`.

Prefer waiting on a condition (`waitFor`, `expect.poll`) over sleeping: the collab
tests are timing-sensitive by nature and fixed delays make them flaky.
