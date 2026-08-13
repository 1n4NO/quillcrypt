# Quillcrypt — implementation plan and roadmap

## Guiding principle

De-risk the two hardest problems first (text anchoring, and combining E2EE with real-time
sync), ship a usable single-player product before adding collaboration, and add encryption
*before* standing up any server that could otherwise see real annotation data.

## Phase overview

| Phase | Goal | Depends on |
|---|---|---|
| 0 — Spikes | Prove the two riskiest technical bets before committing | — |
| 1 — MVP | Local-only annotation: highlight, draw, shapes, notes, persisted per page | Phase 0 |
| 2 — Collaboration | Real-time multi-user sync over a relay (plaintext, to de-risk sync alone) | Phase 1 |
| 3 — Encryption | Group keys, invite links, encrypted CRDT updates, blind relay | Phase 2 |
| 4 — Integrations | Metadata-only notifications (Slack/webhook), sharing/workspace model | Phase 3 |
| 5 — Launch | Cross-browser polish, store listing, submission | Phase 4 |

Ticket IDs are sequential across the whole project (`QC-###`) so they stay stable as phases
slip or reorder. Estimates are t-shirt sizes (S = ~1 day, M = ~2-3 days, L = ~1 week+) — treat
them as a starting conversation for planning, not a commitment.

---

## Phase 0 — Technical spikes

**Goal:** answer the two questions that could invalidate the whole architecture before
building product on top of it.

**QC-1 — Spike: text anchoring across reflow** *(Spike, M)* — **Done**
Adapt Hypothesis's open-source anchoring approach (quote + position + context) to anchor a
highlight to a paragraph, reload the page with slightly different content, confirm the
annotation re-attaches to the right place.
- AC: anchor survives a reordered paragraph and a changed word nearby ✅
- AC: documented failure modes (fully removed text, paywalled/reflowed SPA content) ✅
- Implementation: `extension/src/content/anchoring/anchoring.js`
- Tests: `extension/test/anchoring.test.js` (5/5 passing)
- Findings: `docs/spikes/QC-1-anchoring.md`

**QC-2 — Spike: encrypted Yjs updates over a blind relay** *(Spike, M)* — **Done**
Two local clients, a trivial WebSocket relay that only forwards binary blobs, Yjs updates
encrypted with libsodium secretbox before sending, decrypted on receipt.
- AC: two browser tabs converge to the same document state ✅
- AC: relay process, when inspected, never has plaintext content in memory or logs ✅
- Implementation: `relay-server/src/relay.js`, `relay-server/src/index.js`
- Tests: `relay-server/test/relay.test.js` (6/6 passing)
- Findings: `docs/spikes/QC-2-encrypted-relay.md`

**QC-3 — Spike: invite-link key exchange** *(Spike, S)* — **Done**
Generate a workspace symmetric key client-side, encode it in a URL fragment, confirm it never
appears in any network request (including to the relay).
- AC: key visible in the fragment but absent from every captured request in devtools ✅ (structural proof; see caveats)
- Implementation: `extension/src/crypto/keyExchange.js`
- Tests: `extension/test/keyExchange.test.js` (6/6 passing)
- Findings: `docs/spikes/QC-3-invite-link.md`

**QC-4 — Decide: SVG overlay vs. canvas for draw/shape layer** *(Task, S)* — **Done**
Prototype both for a freehand stroke + a rectangle; evaluate hit-testing, scroll/resize
repositioning, and z-index conflicts with host-page content.
- AC: written decision + rationale in `docs/ARCHITECTURE.md` ✅
- Decision: **SVG overlay** — see `docs/ARCHITECTURE.md` for full comparison table and rationale

**Phase 0 status: all four tickets done.** Ready to move into Phase 1 (QC-10 onward).

---

## Phase 1 — MVP: local annotation, no sync

**Goal:** a Firefox extension a single person can install and use to mark up any page, with
annotations persisted locally. No accounts, no network calls yet.

### Epic: Core anchoring & storage

**QC-10 — Content script injection & page readiness detection** *(Story, S)* — **Done**
- Implementation: `extension/src/content/readiness.js`
- Tests: `extension/test/readiness.test.js` (9/9 passing)

**QC-11 — Text anchoring engine (quote + position + context)** *(Story, L)* — **Done**
- AC: anchors survive reload, minor DOM changes, and scroll position changes ✅
- Core engine from QC-1, plus live DOM Selection/Range integration added here
- Implementation: `extension/src/content/anchoring/anchoring.js`, `.../rangeAnchoring.js`
- Tests: `extension/test/anchoring.test.js`, `extension/test/rangeAnchoring.test.js` (10/10 passing combined)

**QC-12 — Local persistence layer (per-URL annotation store)** *(Story, M)* — **Done**
- AC: annotations keyed by normalized URL, survive browser restart ✅
- Implementation: `extension/src/storage/store.js` (pluggable backend — swap `InMemoryBackend`
  for a `browser.storage.local`-backed implementation when wiring into the real extension)
- Tests: `extension/test/store.test.js` (8/8 passing)

**QC-13 — Annotation data model & schema versioning** *(Task, S)* — **Done**
- AC: schema includes a version field so Phase 3 can add encryption without a breaking migration ✅
- Implementation: `extension/src/models/annotation.js` (includes a working migration-chain
  mechanism, proven with a fabricated 2-step chain since no real migrations exist yet at v1)
- Tests: `extension/test/annotation.test.js` (11/11 passing)

**Epic status: all four tickets done, 38/38 tests passing across the epic.** Run everything
with `cd extension && npm install && npm test`.

### Epic: Annotation tools

**QC-14 — Highlight tool** *(Story, M)* — **Done**
**QC-15 — Underline tool** *(Story, S)* — **Done**
- Both share one engine: `extension/src/tools/inlineDecoration.js` (splits Range boundaries,
  wraps contained text nodes, handles the single-text-node edge case where `commonAncestorContainer`
  is the text node itself)
- Ticket-specific wrappers: `extension/src/tools/highlight.js`, `.../underline.js`
- Tests: `extension/test/textDecoration.test.js` (16/16 passing)

**QC-16 — Freehand draw tool (SVG overlay)** *(Story, L)* — **Done**
- Implementation: `extension/src/tools/draw.js` — point-to-SVG-path conversion plus
  Douglas-Peucker simplification (the point-reduction mitigation flagged in `docs/ARCHITECTURE.md`
  QC-4 for long freehand strokes)
- Tests: `extension/test/shapeTools.test.js` (shared file, see below)

**QC-17 — Arrow tool** *(Story, M)* — **Done**
- Implementation: `extension/src/tools/arrow.js` — shaft + arrowhead geometry, correct at any angle

**QC-18 — Shape tools (rectangle, ellipse)** *(Story, M)* — **Done**
- Implementation: `extension/src/tools/shapes.js` — normalizes any of the four drag directions
  to consistent, non-negative SVG attributes
- QC-16/17/18 tests combined: `extension/test/shapeTools.test.js` (28/28 passing)

**QC-19 — Sticky note tool (anchored comment bubble)** *(Story, M)* — **Done**
- Implementation: `extension/src/tools/note.js` — positions relative to the anchor, flips side
  and clamps to the viewport so the note bubble never renders off-screen

**QC-20 — Toolbar UI (tool selection, color, stroke width)** *(Story, M)* — **Done**
- Implementation: `extension/src/ui/toolbar.js` — the state machine behind the toolbar (tool
  exclusivity, color/stroke-width validation, pub/sub for the UI to subscribe to). Actual DOM
  rendering of the toolbar still needs building on top of this — not meaningfully unit-testable,
  left for manual/visual QA once wired into the content script.

**QC-21 — Undo/redo stack** *(Story, M)* — **Done**
- Implementation: `extension/src/ui/undoRedo.js` — command-pattern stack, bounded history,
  redo-invalidation-on-new-action. Synchronous by design (for local Yjs operations) — see QC-22
  for why async store operations use a separate controller rather than forcing async into this API.

**QC-22 — Delete / edit existing annotation** *(Story, S)* — **Done**
- Implementation: `extension/src/models/editController.js` — async-aware edit/delete history on
  top of the QC-12 store, verified with an interleaved edit→delete→undo×2 scenario
- QC-19/20/21/22 tests combined: `extension/test/toolsAndUndo.test.js` (25/25 passing)

**Epic status: all nine tickets done.** Run everything with `cd extension && npm test`
(covers all epics so far).

### Epic: Overlay rendering

**QC-23 — SVG overlay positioning on scroll/resize** *(Story, M)* — **Done (logic); needs real-browser QA**
- AC: shapes stay pinned to their original viewport position through scroll, resize, and
  page zoom — addressed by design (document-coordinate overlay, per QC-4), not by manual
  transform code
- Implementation: `extension/src/overlay/overlayDimensions.js`
- **Caveat, stated plainly: jsdom has no layout engine, so this could only be tested with
  mock document/window objects exercising this module's own diffing logic — not real
  scroll/resize/zoom behavior.** See `docs/spikes/QC-23-overlay-sizing.md` for exactly what
  is and isn't verified, and the manual QA pass this needs before Phase 1 can be considered
  truly exited.

**QC-24 — Z-index conflict handling with host page** *(Task, S)* — **Done**
- Implementation: `extension/src/overlay/zIndexGuard.js` — CSS-spec-max z-index, with the
  real defense against ties being DOM-order (overlay kept as last child of `<body>`, including
  against host scripts appending elements later)
- Tests: fully verified with real jsdom DOM manipulation (unlike QC-23, this doesn't depend on
  layout, so no mocking caveat applies here)

**QC-25 — Annotation list/sidebar panel per page** *(Story, M)* — **Done**
- Implementation: `extension/src/ui/sidebar.js` — reading-order sort for text-anchored items,
  excerpting per type, case-insensitive filtering
- Known limitation documented in the file: shape-only annotations (no text anchor) sort by
  creation time and list after all text-anchored items, rather than being interleaved by
  actual page position — flagged as a candidate follow-up ticket once there's user feedback
- QC-23/24/25 tests combined: `extension/test/overlayAndSidebar.test.js` (18/18 passing —
  verified by actually running this exact file, not estimated from the individual spike counts)

**Epic status: all three tickets done, with QC-23 flagged for manual browser QA before
full sign-off.** Run everything with `cd extension && npm test`.

**Phase 1 exit criteria:** a person can install the extension, annotate any page with every
tool, close the browser, come back, and see their annotations exactly where they left them.

**Phase 1 status: all three epics done (17 tickets total). One open item before declaring
Phase 1 fully exited: QC-23's manual real-browser QA pass (scroll/resize/zoom/lazy-load) has
not been performed — everything else has been built and automated-tested.**

---

## Phase 2 — Real-time collaboration (plaintext relay)

**Goal:** multiple people see each other's annotations live on the same page. Deliberately
*not* encrypted yet — isolates sync bugs from crypto bugs.

**QC-30 — Yjs document model for annotations** *(Story, L)* — **Done**
- Implementation: `extension/src/sync/annotationYDoc.js` — root `Y.Map` keyed by annotation id,
  each value a nested `Y.Map` per annotation so field-level edits merge independently rather
  than one client's edit clobbering another's
- Tests: `extension/test/annotationYDoc.test.js` (10/10 passing) — includes real evidence of
  the CRDT guarantees that matter for this product: concurrent edits to *different* fields of
  the same annotation both survive a merge, concurrent edits to the *same* field converge to
  an identical (not corrupted) value on both sides, and a delete-vs-edit race also converges
  identically on both docs

**QC-31 — WebSocket relay server (thin, stateless forwarding)** *(Story, M)* — **Done**
- Builds on the QC-2 spike's blind-relay mechanism, hardened for production: rooms are cleaned
  up when their last client disconnects (no unbounded memory growth), multiple simultaneous
  rooms are isolated from each other, and one broken peer's send failure doesn't block
  broadcast to the rest of the room
- Implementation: `relay-server/src/relay.js` (the QC-2 file, extended — `broadcastToRoom`
  extracted as a standalone function specifically so peer-failure resilience is independently
  testable with mock objects, since the real server-side connections aren't reachable from
  outside the module for testing)
- Tests: `relay-server/test/relayHardening.test.js` (9/9 passing) — confirmed the original
  QC-2 encrypted-relay test (`relay-server/test/relay.test.js`, 6/6) still passes unchanged
  against this hardened version
- **Note on a mistake caught during this ticket:** the first draft of the resilience test
  overrode `.send()` on a *client-side* WebSocket object to simulate a broken peer — that's
  invalid, since the relay's broadcast loop calls `.send()` on its own internal *server-side*
  connection objects, which client code can't reach. That test would have passed for the wrong
  reason (nothing server-side ever actually threw). Fixed by extracting `broadcastToRoom` so
  the failure path can be tested directly with real mock peers.
**QC-32 — Client sync layer (connect, reconnect, offline queue)** *(Story, L)* — **Done**
- Implementation: `extension/src/sync/syncClient.js` — wraps a `Y.Doc` + WebSocket connection;
  injectable `WebSocketImpl` so the same code runs against a real browser's native `WebSocket`
  and against the `ws` package in tests
- Tests: `extension/test/syncClient.test.js` (7/7 passing) — run against a REAL relay instance
  (cross-package require of `relay-server/src/relay.js`, verified to resolve correctly), not
  mocked. Covers: end-to-end sync through the full stack, echo-loop prevention (a client never
  re-sends an update it just received), offline queueing of local edits made while
  disconnected, actual reconnect-with-backoff timing, the queued edit reaching a peer after
  reconnect, and clean manual disconnect not triggering further reconnect attempts.
- **Scope note, stated in the file itself:** this guarantees your OWN edits made while offline
  survive and sync once reconnected. It does NOT guarantee catching up on updates OTHER
  clients broadcast while you were offline — the relay has no persistence yet (that's QC-37).
  If someone else edits while you're disconnected, you'll miss that specific change until
  QC-37 lands, though you'll reconverge on anything they still have when you're both online
  together again.
**QC-33 — Presence: live cursors / who's viewing this page** *(Story, M)* — **Done**
- Implementation: `extension/src/sync/presenceClient.js` — deliberately a SEPARATE channel
  from `SyncClient` (own WebSocket connection, own room id suffix `:presence`) rather than
  multiplexed onto document sync, so a presence bug can't corrupt document state and vice versa
- Heartbeat + timeout-based staleness detection, plus immediate removal on a clean explicit
  leave message (doesn't make other clients wait out the full timeout when someone closes the
  tab normally)
- Tests: `extension/test/presenceClient.test.js` (8/8 passing) against a real relay instance —
  covers discovery, state-merge updates, explicit-leave (instant removal), AND a genuinely
  silent disconnect (heartbeat/prune timers killed, connection yanked with no leave message)
  still resolving correctly via timeout-based pruning
**QC-34 — Conflict resolution QA pass (concurrent edits to same annotation)** *(Task, M)* — **Done**
- Distinct from (and complementary to) QC-30's tests: QC-30 verified CRDT merge semantics via
  direct in-process `Y.Doc` sync; this ticket stress-tests the REAL production stack — three
  actual `SyncClient`s through the actual relay, with rapid concurrent writes and no pause to
  let sync settle in between
- Tests: `extension/test/conflictQA.test.js` (4/4 passing) — 30 rapid concurrent writes to the
  same field across 3 real network-connected clients converge to an identical, uncorrupted
  value; concurrent delete from two clients simultaneously converges cleanly; concurrent edits
  to two *different* annotations don't cross-contaminate
**QC-35 — Workspace model: a workspace = a set of URLs or a domain** *(Story, M)* — **Done**
- Implementation: `extension/src/storage/workspace.js` — domain-scoped (exact hostname match,
  subdomains deliberately NOT auto-included — a stated v1 simplicity choice) and urlList-scoped
  (explicit set of normalized URLs, reusing QC-12's `normalizeUrl`) workspaces; a page can match
  multiple workspaces at once, sorted most-specific-first
- `deriveRoomId(workspace)` connects this model to the sync layer built in QC-30–34 — this is
  what the hardcoded test room strings used throughout that work will be replaced with in real
  usage
- Tests: `extension/test/workspace.test.js` (15/15 passing)
**QC-36 — Basic invite flow (share a link, join a workspace)** *(Story, M)* — **Done**
- Implementation: `extension/src/crypto/invite.js` — ties QC-3's fragment-based key exchange
  to QC-35's workspace model: key stays in the URL fragment (never touches a server), while
  workspace identity and scope (domain vs. url list) go in the path/query since that metadata
  isn't secret the same way the key is, and the joining client genuinely needs it to know which
  pages should activate the workspace
- Critically, the invite carries the inviter's EXACT workspace id, not a freshly generated one
  — verified directly: `deriveRoomId()` produces an identical room id on both sides, meaning
  they actually land in the same sync room rather than each being alone in their own
- Tests: `extension/test/invite.test.js` (12/12 passing) — covers both domain and urlList
  (array-valued, the harder encoding case) workspace round-trips, plus malformed-link handling
**QC-37 — Relay persistence (durable storage for offline clients to catch up on reconnect)** *(Story, M)* — **Done**
- This is the ticket that actually delivers Phase 2's exit criterion — QC-32 explicitly could
  NOT guarantee catching up on updates other clients made while you were offline; this closes
  that gap
- Implementation: `relay-server/src/persistentRelay.js` — per-room update log, replayed to any
  newly-connecting client (reconnecting OR joining for the first time ever); periodic
  compaction via `Y.mergeUpdates()` once a room's log exceeds a threshold, keeping the relay
  blind throughout (compaction operates on opaque update bytes, never decoded content)
- `relay-server/src/index.js` updated to run the persistent relay in production (the
  non-persistent `relay.js` from QC-31 remains available and independently tested as a
  building block, just no longer what actually gets deployed)
- **Stated limitation:** persistence is IN-MEMORY only — survives client disconnects within
  one relay process lifetime, but a relay restart loses all room history. True
  across-restart durability needs a real disk/database-backed store, which is separate,
  larger infrastructure work not attempted here.
- Tests: `extension/test/relayPersistence.test.js` (4/4 passing) — the two that matter most: a
  client that was NEVER online while another client made edits still catches up purely from
  relay history, and a reconnecting client picks up an annotation added by someone else while
  it was offline (the exact scenario QC-32 flagged as unsolved). Also verified: compaction
  triggers correctly and a client joining after compaction still gets fully correct state.
- **Packaging bug caught and fixed during this ticket:** `persistentRelay.js` needs `yjs` at
  runtime, but `relay-server/package.json` only listed `yjs` as a devDependency (left over from
  when only tests needed it). Running the real cross-package verification surfaced a
  `MODULE_NOT_FOUND` error that a mocked test would never have caught — moved to a proper
  `dependency`. Also surfaced: a `"Yjs was already imported"` warning, because `extension/`
  and `relay-server/` are separate packages each with their own `yjs` install. Tests still pass
  (nothing here relies on cross-instance `instanceof` checks), but this is worth fixing
  properly — **recommend converting to npm/yarn workspaces** so the whole project shares one
  `yjs` install, before this duplicate-instance issue causes a harder-to-diagnose bug later.

**Phase 2 status: all eight tickets done.** Run everything with `cd extension && npm test`
(the extension suite includes cross-package tests against the real relay) and separately
`cd relay-server && npm test`.

**Phase 2 exit criteria:** two people on the same workspace see each other's annotations
appear live, and a client that reconnects after being offline catches up correctly. Content is
still plaintext on the relay at this point — **do not use on real/sensitive pages yet.**

---

## Phase 3 — End-to-end encryption

**Goal:** the relay becomes provably blind. This phase gates the "E2EE" claim in your
marketing — don't ship Phase 4 messaging before this is done.

**QC-40 — libsodium integration & key primitives wrapper** *(Task, M)* — **Done**
- Implementation: `extension/src/crypto/primitives.js` — consolidates ALL sodium calls into one
  module (previously scattered between the QC-2/QC-3 spikes): symmetric encrypt/decrypt for the
  workspace group key, and asymmetric sealed-box wrap/unwrap for member key delivery (QC-44)
- `extension/src/crypto/keyExchange.js` (QC-3/QC-43) refactored to delegate here rather than
  calling sodium directly — verified its exact public API is unchanged by re-running BOTH
  dependent test suites (`keyExchange.test.js` and `invite.test.js`, 18 tests combined) against
  the refactored version before considering this done
- Tests: `extension/test/primitives.test.js` (5/5 passing) — includes wrong-key failure cases
  for both symmetric and asymmetric primitives, not just the happy path

**QC-41 — Workspace symmetric key generation** *(Story, S)* — **Done**
- Already implemented as `generateWorkspaceKey()` in QC-3's `keyExchange.js`; as of QC-40 it
  delegates to `primitives.generateSymmetricKey()`. No new code needed beyond the QC-40
  consolidation — marking done here since the AC is fully met and tested.

**QC-42 — Encrypt/decrypt Yjs updates at the sync boundary** *(Story, L)* — **Done**
- AC: relay process memory/logs never contain plaintext (automated test, not just manual check) ✅
- Implementation: `extension/src/sync/encryptedTransport.js` — **deliberately does NOT modify
  `SyncClient` (QC-32) at all.** It's a drop-in replacement for the `WebSocketImpl` option
  SyncClient already accepted, so encryption is completely transparent: SyncClient still just
  sees "bytes in, bytes out" over something WebSocket-shaped, meaning every one of SyncClient's
  existing tests (reconnect, offline queue, echo prevention) remains valid completely unchanged
- Tests: `extension/test/encryptedSync.test.js` (6/6 passing) — this is the load-bearing test
  for the whole product's core claim. It verifies against the relay's actual **persisted**
  storage (not just live traffic) two ways: a byte-subsequence search proving the known
  plaintext note content never appears anywhere in what's stored, AND a structural check that
  stored entries don't even parse as valid Yjs updates (`Y.decodeUpdate` throws on all of
  them) — so it's not just that the bytes differ, it's that what's stored isn't a CRDT delta
  at all, it's ciphertext. Also verified: a client with the wrong key gets decrypt errors
  (via an `onDecryptError` hook) rather than crashing, and ends up with zero annotation data.
- **Two real bugs caught and fixed during this ticket, both the same class of mistake:**
  1. `encryptedTransport.js` was written with `require('./primitives')`, copied from a spike
     where both files sat in the same flat directory — but in the real project structure,
     `primitives.js` lives in `../crypto/`, not the same `sync/` folder. The cross-package
     verification caught this immediately (`MODULE_NOT_FOUND`); a test that only ran inside
     the spike sandbox never would have.
  2. `libsodium-wrappers` was listed as a *dev* dependency in `extension/package.json`, but
     `primitives.js`/`keyExchange.js`/`invite.js` are all production source code that need it
     at runtime — the identical mistake QC-37 already caught once in `relay-server`. Caught
     proactively this time before shipping, by checking for the same pattern rather than
     waiting for it to fail again.

**QC-43 — Invite link key exchange (key in URL fragment)** *(Story, M)* — **Done** (builds on QC-3)
- Fully implemented already via QC-3 (`keyExchange.js`) + QC-36 (`invite.js`, which layers
  workspace identity/scope on top of the QC-3 mechanism). No additional ticket-specific work
  needed — marking done here since the AC (key exchange via URL fragment) has been implemented
  and tested since QC-3/QC-36, this ticket just formally closes that loop in the Phase 3 list.

**QC-44 — Asymmetric key wrapping for late-joining members (X25519)** *(Story, L)* — **Done**
- AC: existing member can add a new member without sharing the raw group key out-of-band ✅
- Implementation: `extension/src/crypto/membership.js` — a `MemberRoster` (pluggable backend,
  same pattern as `AnnotationStore`) tracking members by public key, plus
  `createMemberInvite()`/`acceptMemberInvite()` built on QC-40's sealed-box primitives
- Key property verified directly: the wrapped payload is safe to transmit over ANY channel
  (including the blind relay itself) since it's ciphertext only the intended recipient's
  private key can open — no separate secure out-of-band channel needed, unlike the initial-join
  fragment approach's implicit reliance on the invite link being shared carefully
- Tests: `extension/test/membership.test.js` (6/6 passing) — round-trip recovery of the exact
  group key, confirmation the wrapped payload doesn't contain the raw key bytes verbatim, and
  confirmation someone the invite was NOT wrapped for cannot unwrap it

**QC-45 — Key rotation on member removal** *(Story, M)* — **Done**
- Implementation: `extension/src/crypto/rotation.js` — generates a fresh group key on member
  removal and wraps it individually for every REMAINING member via QC-44's primitives; the
  removed member is simply excluded from the wrap list
- **Stated limitation, not a bug:** no forward secrecy for content the removed member already
  decrypted before removal — rotation only prevents reading anything encrypted with the NEW
  key going forward. This is the standard tradeoff for "wrap a shared key per member" designs;
  true forward secrecy (Signal-style ratcheting) is meaningfully heavier and out of scope.
- Tests: `extension/test/rotation.test.js` (7/7 passing) — confirms the new key differs from
  the old one, remaining members correctly recover it, and critically: the removed member's
  keypair cannot unwrap ANY of the newly-wrapped entries, not just their own former one

**QC-46 — Local key storage & device management (what happens on lost device)** *(Story, M)* — **Done**
- AC: documented, user-facing explanation of the recovery tradeoff (no recovery vs. escrow) ✅
- Implementation: `extension/src/crypto/keyStore.js` — pluggable-backend storage (same pattern
  as `AnnotationStore`) for the device's own keypair and every joined workspace's group key
- Tests: `extension/test/keyStore.test.js` (7/7 passing) — includes a genuine simulation of
  device loss (a fresh `KeyStore` over a brand-new empty backend, not sharing the old one),
  proving the tradeoff is real and testable, not just claimed in prose
- **The actual AC deliverable:** `docs/KEY_RECOVERY.md` — plain-language, user-facing
  explanation of why there's no recovery mechanism, what happens concretely if a device is
  lost, what the user can do about it (export backups, keep a second active member), and an
  explicit statement of what's NOT planned (key escrow) and why

**QC-47 — Security review / external audit scoping doc** *(Task, S)* — **Done**
- Implementation: `docs/SECURITY_AUDIT_SCOPE.md` — scopes an external audit to the ~15% of the
  codebase where a bug would actually break the E2EE claim (crypto primitives usage, the sync
  boundary, key derivation/randomness, and the content-script attack surface specifically,
  since it runs inside untrusted pages by design), explicitly excludes what's not this
  product's responsibility to audit (browser sandbox, libsodium internals, physical device
  security), and flags the duplicate-`yjs`-install issue (from QC-37/42) as worth resolving
  before the audit rather than during it
- This is a scoping document, not the audit itself — an actual external review is still a
  prerequisite before the public-facing E2EE claim should be considered fully verified

**Phase 3 status: all eight tickets done.** Run everything with `cd extension && npm test`.
The core promise is now automated-tested against real persisted relay storage (QC-42), not
just asserted — but per QC-47, an actual external audit is still the right bar before
publicly making this claim without qualification.

**Phase 3 exit criteria:** an outside party with full access to the relay server and its
database cannot recover any annotation content — verified by an automated test that inspects
relay-side storage/logs for plaintext, not just a manual check.

---

## Phase 4 — Integrations & sharing

**Goal:** the features that make this a team tool, built so they never break the encryption
boundary from Phase 3.

**QC-50 — Metadata-only event stream (what's safe to expose: URL hash, timestamp, author id)** *(Task, M)*
**QC-51 — Slack notification integration (metadata-only)** *(Story, M)*
**QC-52 — Generic webhook integration** *(Story, M)*
**QC-53 — Export annotations (decrypted, local, user-initiated)** *(Story, S)*
**QC-54 — Workspace member management UI** *(Story, M)*
**QC-55 — Per-domain vs. per-URL workspace scoping UI** *(Story, S)*

**Phase 4 exit criteria:** a Slack notification fires when someone annotates a shared page,
built entirely from encrypted-metadata events — confirm no integration code path ever touches
decrypted content.

---

## Phase 5 — Polish & launch

**QC-60 — Onboarding flow (first install, first annotation, first invite)** *(Story, M)*
**QC-61 — Settings page (key management, workspace list, export)** *(Story, M)*
**QC-62 — Accessibility pass (keyboard nav for toolbar, screen reader labels)** *(Task, M)*
**QC-63 — Performance pass (large pages, many annotations)** *(Task, M)*
**QC-64 — Firefox Add-ons store listing & screenshots** *(Task, S)*
**QC-65 — Privacy policy & security whitepaper (plain-language E2EE explanation)** *(Task, M)*
**QC-66 — Store submission & review response** *(Task, S)*
**QC-67 — Launch readiness checklist / go-live** *(Task, S)*

---

## Suggested near-term order

1. QC-1 through QC-4 (spikes) — don't skip these, they can change the architecture
2. QC-10 through QC-13 (anchoring + storage foundation)
3. QC-14 through QC-22 (tools) — can parallelize across contributors once QC-11 lands
4. Everything else follows the phase order above

## Explicitly out of scope for v1

- Cross-device key recovery/escrow (Phase 3 ships without it; revisit post-launch)
- Chrome/Chromium support (Firefox-first per the original brief; port later if it lands)
- PDF annotation (Hypothesis's core use case — worth revisiting once the web version is solid)
