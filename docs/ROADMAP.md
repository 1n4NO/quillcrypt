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

**QC-10 — Content script injection & page readiness detection** *(Story, S)*
**QC-11 — Text anchoring engine (quote + position + context)** *(Story, L)*
- AC: anchors survive reload, minor DOM changes, and scroll position changes
**QC-12 — Local persistence layer (per-URL annotation store)** *(Story, M)*
- AC: annotations keyed by normalized URL, survive browser restart
**QC-13 — Annotation data model & schema versioning** *(Task, S)*
- AC: schema includes a version field so Phase 3 can add encryption without a breaking migration

### Epic: Annotation tools

**QC-14 — Highlight tool** *(Story, M)*
**QC-15 — Underline tool** *(Story, S)*
**QC-16 — Freehand draw tool (SVG overlay)** *(Story, L)*
**QC-17 — Arrow tool** *(Story, M)*
**QC-18 — Shape tools (rectangle, ellipse)** *(Story, M)*
**QC-19 — Sticky note tool (anchored comment bubble)** *(Story, M)*
**QC-20 — Toolbar UI (tool selection, color, stroke width)** *(Story, M)*
**QC-21 — Undo/redo stack** *(Story, M)*
**QC-22 — Delete / edit existing annotation** *(Story, S)*

### Epic: Overlay rendering

**QC-23 — SVG overlay positioning on scroll/resize** *(Story, M)*
- AC: shapes stay pinned to their original viewport position through scroll, resize, and
  page zoom
**QC-24 — Z-index conflict handling with host page** *(Task, S)*
**QC-25 — Annotation list/sidebar panel per page** *(Story, M)*

**Phase 1 exit criteria:** a person can install the extension, annotate any page with every
tool, close the browser, come back, and see their annotations exactly where they left them.

---

## Phase 2 — Real-time collaboration (plaintext relay)

**Goal:** multiple people see each other's annotations live on the same page. Deliberately
*not* encrypted yet — isolates sync bugs from crypto bugs.

**QC-30 — Yjs document model for annotations** *(Story, L)*
**QC-31 — WebSocket relay server (thin, stateless forwarding)** *(Story, M)*
**QC-32 — Client sync layer (connect, reconnect, offline queue)** *(Story, L)*
**QC-33 — Presence: live cursors / who's viewing this page** *(Story, M)*
**QC-34 — Conflict resolution QA pass (concurrent edits to same annotation)** *(Task, M)*
**QC-35 — Workspace model: a workspace = a set of URLs or a domain** *(Story, M)*
**QC-36 — Basic invite flow (share a link, join a workspace)** *(Story, M)*
**QC-37 — Relay persistence (durable storage for offline clients to catch up on reconnect)** *(Story, M)*

**Phase 2 exit criteria:** two people on the same workspace see each other's annotations
appear live, and a client that reconnects after being offline catches up correctly. Content is
still plaintext on the relay at this point — **do not use on real/sensitive pages yet.**

---

## Phase 3 — End-to-end encryption

**Goal:** the relay becomes provably blind. This phase gates the "E2EE" claim in your
marketing — don't ship Phase 4 messaging before this is done.

**QC-40 — libsodium integration & key primitives wrapper** *(Task, M)*
**QC-41 — Workspace symmetric key generation** *(Story, S)*
**QC-42 — Encrypt/decrypt Yjs updates at the sync boundary** *(Story, L)*
- AC: relay process memory/logs never contain plaintext (automated test, not just manual check)
**QC-43 — Invite link key exchange (key in URL fragment)** *(Story, M)* — builds on QC-3
**QC-44 — Asymmetric key wrapping for late-joining members (X25519)** *(Story, L)*
- AC: existing member can add a new member without sharing the raw group key out-of-band
**QC-45 — Key rotation on member removal** *(Story, M)*
**QC-46 — Local key storage & device management (what happens on lost device)** *(Story, M)*
- AC: documented, user-facing explanation of the recovery tradeoff (no recovery vs. escrow)
**QC-47 — Security review / external audit scoping doc** *(Task, S)*

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
