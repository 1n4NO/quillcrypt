# QC-67 — Launch readiness checklist

**Purpose:** a single honest go/no-go view before shipping. This pulls together every
outstanding item flagged across the whole roadmap — nothing here is new, it's a consolidation.

## Engineering — done and automated-tested

Everything in Phases 0–4 is built and covered by automated tests. Run `npm test` from the repo
root (after the one-time workspaces setup — see the root `README.md`) to confirm current
counts for yourself.

## Explicitly NOT done — read this before deciding to launch

Several previously-flagged gaps have been resolved since this checklist was first written
(marked below with what changed). One significant gap was only discovered while re-checking
this list, not caught earlier — flagged plainly rather than glossed over.

0. **NEWLY DISCOVERED — `content-script.js` and `background.js` are still empty scaffolds.**
   Every module described below (anchoring, tools, sync, encryption, UI views) is real, tested
   library code — but nothing actually calls any of it from the extension's real entry points.
   `manifest.json` is valid and icons exist, so the extension would install in Firefox, but it
   would do nothing when installed: no content script mounts the overlay, no toolbar renders,
   no sync client connects. **This is the actual top-priority gap**, ahead of even the manual
   QA pass below — there's no running extension to QA yet. Wiring this up is real, bounded
   integration work (call `injectOnce` → mount the SVG overlay → `mountToolbar` → wire tool
   selection to the anchoring/draw code → connect `SyncClient`), not a new architecture
   decision, since every piece it needs to call already exists and is tested in isolation.

1. **QC-23's manual real-browser QA has not been performed** — and can't meaningfully happen
   until item 0 above is done, since there's currently nothing to load and interact with.

2. **QC-47's security audit is scoped, not performed.** `docs/SECURITY_AUDIT_SCOPE.md` tells an
   auditor where to look; no external party has actually reviewed the code yet. The public
   privacy policy (`docs/PRIVACY_POLICY.md`) already says this plainly — don't quietly remove
   that caveat before an audit actually happens.

3. ~~**Duplicate `yjs` installs**~~ — **RESOLVED.** npm workspaces monorepo; verified the
   "already imported" warning is genuinely gone by re-running a cross-package sync test under
   the new structure.

4. ~~**Extension icons are still SVG-only.**~~ — **RESOLVED.** Real PNG icons generated and
   placed at `extension/icons/`.

5. **No real product screenshots exist** (QC-64) — blocked on item 0, same as item 1.

6. **Relay persistence is in-memory only** (QC-37) — a relay restart loses all room history.
   Fine for launch if explicitly communicated, but worth deciding deliberately.

7. ~~**No DOM rendering wired up for toolbar/settings/onboarding.**~~ — **RESOLVED, but see
   item 0.** The three UI *components* are real and tested:
   - `extension/src/ui/toolbarView.js` — 21/21 tests
   - `extension/src/ui/settingsView.js` — 11/11 tests
   - `extension/src/ui/onboardingView.js` — 5/5 tests

   What "resolved" means precisely: each component correctly renders and responds to its own
   state layer *when mounted into a container in a test*. What it does NOT mean: that any of
   them are actually mounted anywhere in the real extension. That's item 0 — this item was
   marked resolved prematurely in an earlier version of this doc, conflating "the component
   exists and is tested" with "the component is wired into a running extension." Correcting
   that here rather than leaving it.

8. **Chrome support** is explicitly out of scope for v1 (see `docs/ROADMAP.md`), not a gap —
   noted here only because it comes up. Two isolated `manifest.json` changes
   (`browser_specific_settings` removal, `background.scripts` → `background.service_worker`)
   are the actual delta; everything else (sync, crypto, storage, content scripts) is standard
   WebExtension API and needs no changes.

## Recommended order to close what's left

1. ~~Generate real icon PNGs~~ — done
2. ~~Build DOM view components for toolbar/settings/onboarding~~ — done
3. **Wire those components (and the anchoring/tool/sync modules) into
   `content-script.js`/`background.js`** — this is the actual current top priority
4. Do the QC-23 manual browser QA pass, now that there's something to load
5. Capture real screenshots
6. ~~Resolve npm workspaces / duplicate-yjs~~ — done
7. Commission the QC-47 external audit
8. Decide explicitly on relay persistence durability
9. Submit to the Firefox Add-ons store per `docs/STORE_SUBMISSION_PREP.md`

## Go/no-go recommendation

**Not ready for public launch.** All the hard engineering problems are solved and verified —
anchoring, CRDT sync, real E2EE against persisted relay storage, real UI components — but
they're not yet connected to each other in a runnable extension. That connection work (item 0)
is the honest next step, not audit or polish.
