/**
 * Stage 2 verification (runnable): drives two real YjsCollabProvider instances
 * against an in-memory hub that mirrors the socket-server blind-relay logic
 * (yjs:join / role / state-request / state / msg). Proves seed-authority, late-
 * joiner sync, and convergence of concurrent edits — with no browser/network.
 *
 *   npx tsx components/transcriptions/editor/text/collab/transport.proto.ts
 */
import * as Y from "yjs";
import type { TranscriptionContent } from "@/hooks/use-transcriptions";
import { seedYDoc, ydocToContent, getBlocks, getBlockTokens } from "./ydoc-schema";
import { reconcileYDoc } from "./reconcile";
import { YjsCollabProvider, plaintextCodec } from "@/lib/sockets/yjs-collab-provider";

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
    if (extra !== undefined) console.error(JSON.stringify(extra, null, 2).slice(0, 1500));
  }
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------------------
// Minimal in-memory hub mirroring lib/sockets/socket-server.ts blind relay.
// ---------------------------------------------------------------------------
type Room = { authority: string | null; members: Set<string> };

class Hub {
  private rooms = new Map<string, Room>();
  sockets = new Map<string, MockSocket>();

  connect(id: string): MockSocket {
    const s = new MockSocket(id, this);
    this.sockets.set(id, s);
    return s;
  }
  private room(tid: string): Room {
    let r = this.rooms.get(tid);
    if (!r) {
      r = { authority: null, members: new Set() };
      this.rooms.set(tid, r);
    }
    return r;
  }
  receive(from: MockSocket, event: string, data: any) {
    if (event === "yjs:join") {
      const r = this.room(data.transcriptionId);
      r.members.add(from.id);
      if (!r.authority) {
        r.authority = from.id;
        from.deliver("yjs:role", { transcriptionId: data.transcriptionId, role: "seed" });
      } else {
        from.deliver("yjs:role", { transcriptionId: data.transcriptionId, role: "sync" });
      }
    } else if (event === "yjs:state-request") {
      const r = this.room(data.transcriptionId);
      if (!r.authority) {
        r.authority = from.id;
        from.deliver("yjs:role", { transcriptionId: data.transcriptionId, role: "seed" });
        return;
      }
      this.sockets
        .get(r.authority)
        ?.deliver("yjs:state-request", { transcriptionId: data.transcriptionId, requester: from.id });
    } else if (event === "yjs:state") {
      this.sockets.get(data.requester)?.deliver("yjs:state", {
        transcriptionId: data.transcriptionId,
        enc: data.enc,
        d: data.d,
      });
    } else if (event === "yjs:msg") {
      const r = this.room(data.transcriptionId);
      for (const id of r.members)
        if (id !== from.id) this.sockets.get(id)?.deliver("yjs:msg", data);
    } else if (event === "yjs:leave") {
      const r = this.room(data.transcriptionId);
      r.members.delete(from.id);
      if (r.authority === from.id) r.authority = r.members.size ? [...r.members][0] : null;
    }
  }
}

class MockSocket {
  private listeners = new Map<string, Set<(d: any) => void>>();
  connected = true; // synchronous mock is always "connected"
  constructor(
    public id: string,
    private hub: Hub,
  ) {}
  on(e: string, cb: (d: any) => void) {
    if (!this.listeners.has(e)) this.listeners.set(e, new Set());
    this.listeners.get(e)!.add(cb);
  }
  off(e: string, cb: (d: any) => void) {
    this.listeners.get(e)?.delete(cb);
  }
  emit(e: string, d: any) {
    this.hub.receive(this, e, d);
  }
  deliver(e: string, d: any) {
    this.listeners.get(e)?.forEach((cb) => cb(d));
  }
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
const content: TranscriptionContent = {
  speakers: [
    { id: "speaker_0", name: "Alice" },
    { id: "speaker_1", name: "Bob" },
  ],
  words: [
    { type: "word", text: "Salut", start: 0, end: 0.4, speakerId: "speaker_0" },
    { type: "spacing", text: " ", speakerId: "speaker_0" },
    { type: "word", text: "Bob", start: 0.4, end: 0.7, speakerId: "speaker_0" },
    { type: "spacing", text: " ", speakerId: "speaker_1" },
    { type: "word", text: "Oui", start: 1.0, end: 1.3, speakerId: "speaker_1" },
    { type: "spacing", text: " ", speakerId: "speaker_1" },
    { type: "word", text: "bonjour", start: 1.3, end: 1.9, speakerId: "speaker_1" },
  ],
};

const TID = "t1";
const hub = new Hub();

// Client A joins first (becomes seed authority).
const docA = new Y.Doc();
const sockA = hub.connect("A");
const provA = new YjsCollabProvider(sockA as any, TID, docA, plaintextCodec, {
  onSeed: () => seedYDoc(content, docA, "seed"),
});

console.log("Stage 2 transport:");
check("A got seeded (authority)", getBlocks(docA).length > 0);

// Client B joins second (pulls full state from A).
const docB = new Y.Doc();
const sockB = hub.connect("B");
const provB = new YjsCollabProvider(sockB as any, TID, docB, plaintextCodec, {
  onSeed: () => seedYDoc(content, docB, "seed"),
});

check("B synced from peer (not empty)", getBlocks(docB).length > 0);
check("A and B identical after join", eq(ydocToContent(docA).words, ydocToContent(docB).words));

// Concurrent edits: A edits a word in block 0, B appends a word in block 1.
const targetA = ydocToContent(docA);
targetA.words.find((s) => s.text === "Salut")!.text = "Coucou";
reconcileYDoc(docA, targetA, Symbol.for("pm-local")); // any non-provider origin

const targetB = ydocToContent(docB);
// append " vraiment" after "bonjour"
const idx = targetB.words.findIndex((s) => s.text === "bonjour");
targetB.words.splice(
  idx + 1,
  0,
  { type: "spacing", text: " ", speakerId: "speaker_1" },
  { type: "word", text: "vraiment", start: 1.9, end: 2.3, speakerId: "speaker_1" },
);
reconcileYDoc(docB, targetB, Symbol.for("pm-local"));

check("A and B converge after concurrent edits", eq(ydocToContent(docA).words, ydocToContent(docB).words), {
  a: ydocToContent(docA).words,
  b: ydocToContent(docB).words,
});
check("A's edit reached B", ydocToContent(docB).words.some((s) => s.text === "Coucou"));
check("B's edit reached A", ydocToContent(docA).words.some((s) => s.text === "vraiment"));

// No echo storm: token identity for an untouched word is preserved on both docs.
check(
  "no duplication (word 'bonjour' appears once on each)",
  ydocToContent(docA).words.filter((s) => s.text === "bonjour").length === 1 &&
    ydocToContent(docB).words.filter((s) => s.text === "bonjour").length === 1,
);

// Late joiner C after edits: pulls current state from authority A.
const docC = new Y.Doc();
const sockC = hub.connect("C");
new YjsCollabProvider(sockC as any, TID, docC, plaintextCodec, {
  onSeed: () => seedYDoc(content, docC, "seed"),
});
check("late joiner C matches current state", eq(ydocToContent(docC).words, ydocToContent(docA).words), {
  c: ydocToContent(docC).words,
});

// Authority leaves; a new joiner D still syncs (authority reassigned to B).
provA.destroy();
const docD = new Y.Doc();
const sockD = hub.connect("D");
new YjsCollabProvider(sockD as any, TID, docD, plaintextCodec, {
  onSeed: () => seedYDoc(content, docD, "seed"),
});
check("after authority left, D syncs from reassigned authority", getBlockTokens(getBlocks(docD).get(0)).length > 0);
check("D matches B", eq(ydocToContent(docD).words, ydocToContent(docB).words));

void provB;
console.log(failures === 0 ? "\n✅ Stage 2 transport: all checks passed" : `\n❌ ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
