# Testing

Two runners, deliberately split by what they can protect:

| Command             | Runner     | Covers                                                                 | Duration |
| ------------------- | ---------- | ---------------------------------------------------------------------- | -------- |
| `npm test`          | Vitest     | pure logic + the collaboration protocol (real Socket.io, real Y.Docs)  | ~20 s    |
| `npm run test:e2e`  | Playwright | real browsers editing one transcript through the whole app             | ~5 min   |

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
- **`paste-merge.test.ts`** — the word-processor round trip (copy the transcript
  into Word, edit it there, paste it back). A plain paste replaces the whole
  selection and silently takes down speaker attributes, comment anchors and
  derived timestamps with it, so the paste is turned into the minimal diff
  instead. These tests pin that an untouched round trip is a no-op (Word's own
  typography included), that real edits — punctuation and capitalization too —
  ARE applied, that what surrounds them is never rewritten, and that anything
  which is not a recognizable round trip falls back to a normal paste.

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
- **`collab-authorization.test.ts`** — the tests act as the attacker: a fully
  authenticated user emitting the protocol's own events for someone else's
  transcript. Joining, pulling the state, injecting an update and pushing a
  cursor must all be refused, a read-only collaborator's document updates must be
  dropped while their caret still gets through, and a newly granted collaborator
  must get in. Since access is claimed by presenting a **room grant**
  (`lib/sockets/room-grant.ts`), it also forges them: a grant issued to someone
  else, one for another transcription, an expired one, one signed with the wrong
  secret, and a socket token replayed as a grant. The harness mints grants the
  way the API does, from the same `checkAccess` rule.
- **`collab-adversarial.test.ts`** — the awkward schedule: five clients opening
  the same empty room in the same tick (exactly one may seed), the authority
  vanishing before answering a state request, a duplicate join from a socket that
  is already the authority, an edit made while the state transfer is in flight,
  messages delivered out of order, edits typed while disconnected, two clients
  editing the same word, one deleting the paragraph another is typing into,
  join/leave churn, and a multi-megabyte transfer.
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

`tests/e2e/collaboration.spec.ts` covers the happy path: both participants seeing
a shared transcript, edits flowing each way, concurrent typing converging
character for character, a late joiner receiving edits that were never saved,
remote carets, persistence through the save leader, a read-only participant being
unable to type or delete (locally *or* for anyone else), and a stranger getting a
403.

`tests/e2e/collaboration-edge-cases.spec.ts` covers what actually goes wrong: the
save leader closing their tab mid-session (the survivor must take over
persistence), a reload keeping edits that were never saved, edits typed while
offline reaching the others on reconnect, undo reverting your own edit and not
your colleague's, three participants converging, a speaker rename crossing the
Y.Map, and a stranger speaking the socket protocol directly with valid
credentials.

`tests/e2e/paste-merge.spec.ts` covers the word-processor round trip in a real
browser: a genuine `paste` event carrying Word's `text/html` (styled prose, no
`data-speaker-id`, curly apostrophes) over a `Cmd+A` selection. It checks the
wiring the unit suite cannot — that the selection is recognized and the merge
fires — and that the transcript keeps its speakers instead of collapsing onto
`speaker_0`.

Note the two suites use different attack surfaces on purpose: the REST route and
the socket are separate doors, and only testing the first one is how the second
stayed unlocked.

`tests/unit/socket-server-deps.test.ts` guards the constraint that shapes the
socket server's design: it must reach no Prisma anywhere in its import graph, or
it breaks at runtime in the custom server. The test walks the real graph, and
proves it can fail by pointing itself at a module that does use Prisma.

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

**Check that a new test can fail.** Every security- or convergence-critical test
here was verified by breaking the code it protects and watching it go red — a
test that passes against a deliberately broken build is protecting nothing.

## Known gaps

- A read-only participant publishes presence (the server relays it) but no caret
  is drawn for them, because a non-editable ProseMirror has no selection to
  broadcast. `collaboration-edge-cases.spec.ts` documents this where it would be
  asserted if it changes.
- Access revoked mid-session only takes effect on the collaborator's next join:
  authorization is resolved once per socket per room.
- Everything outside collaboration (billing, STT providers, imports, the landing
  pages) still has no coverage.
