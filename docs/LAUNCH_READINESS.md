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

0. **NEWLY DISCOVERED — live entry points are only partially composed.**
   `content-script.js` now mounts local annotations, the SVG overlay, toolbar, and onboarding,
   and Chrome/Firefox bundles are generated. It still does not connect workspace selection,
   encrypted `SyncClient`, presence, member management, or settings to the live extension.
   `background.js` is a lifecycle scaffold rather than a real message/sync coordinator. **This
   remains the top implementation gap**, ahead of manual QA: the single-user path is now real,
   but collaborative product behavior is not yet reachable from the installed extension.

1. **QC-23's manual real-browser QA has not been performed.** The local annotation path is now
   loadable, so this can begin immediately for the single-user experience; collaboration QA
   remains blocked on the live sync wiring above.

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

6. **Relay persistence is now file-backed when `RELAY_DATA_PATH` is configured** — histories
   survive a relay restart and remain opaque base64-encoded bytes on disk. Optional bearer auth,
   origin checks, payload limits, and room/client limits are also available. Retention limits,
   backups, health checks, and graceful shutdown still need production hardening.

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

8. **Chrome support** now has a build path (`npm run build:chrome --workspace=extension`) and a
   Chrome MV3 manifest in `extension/manifest.chrome.json`. It still needs real Chrome unpacked
   install/smoke verification and store packaging before it can be called supported.

## Recommended order to close what's left

1. **Wire workspace selection, encrypted sync, and presence into the live extension**
2. **Add real background messaging and mount settings/sidebar flows**
3. Do the QC-23 manual browser QA pass for Chrome and Firefox
4. Capture real screenshots
5. Commission the QC-47 external audit
6. Decide explicitly on relay persistence durability
7. Harden the landing-page download/store links
8. Submit to browser stores per `docs/STORE_SUBMISSION_PREP.md`

## Go/no-go recommendation

**Not ready for public launch.** All the hard engineering problems are solved and verified —
anchoring, CRDT sync, real E2EE against persisted relay storage, real UI components — but
they're not yet connected to each other in a runnable extension. That connection work (item 0)
is the honest next step, not audit or polish.
