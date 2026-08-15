# QC-67 — Launch readiness checklist

**Purpose:** a single honest go/no-go view before shipping. This pulls together every
outstanding item flagged across the whole roadmap — nothing here is new, it's a consolidation.

## Engineering — done and automated-tested

Everything in Phases 0–4 is built and covered by automated tests. Run `npm test` from the repo
root (after the one-time workspaces setup below) to confirm current counts for yourself.

## Explicitly NOT done — read this before deciding to launch

These are real, previously-flagged gaps. Two have been resolved since this checklist was first
written (marked below); the rest are still open.

1. **QC-23's manual real-browser QA has not been performed.** Scroll/resize/zoom/lazy-load
   behavior for the SVG overlay is verified only at the logic level (jsdom has no layout
   engine). This needs an actual person, in actual Firefox, on an actual long page, before
   Phase 1 can be considered truly exited — not just Phase 5.
2. **QC-47's security audit is scoped, not performed.** `docs/SECURITY_AUDIT_SCOPE.md` tells an
   auditor where to look; no external party has actually reviewed the code yet. The public
   privacy policy (`docs/PRIVACY_POLICY.md`) already says this plainly — don't quietly remove
   that caveat before an audit actually happens.
3. ~~**Duplicate `yjs` installs** across `extension/` and `relay-server/`~~ — **RESOLVED.** The
   repo is now an npm workspaces monorepo (root `package.json`). Verified directly: hoisting a
   single shared `yjs` install and re-running a cross-package sync test that previously
   triggered Yjs's own "already imported" warning confirmed the warning no longer occurs. See
   the root `README.md` for the one-time cleanup step existing checkouts need
   (`rm -rf extension/node_modules relay-server/node_modules` before the first `npm install`
   from the root).
4. ~~**Extension icons are still SVG-only.**~~ — **RESOLVED.** Real PNG icons (16/48/128px)
   generated from `logo/quillcrypt-mark.svg` and placed at `extension/icons/`, matching what
   `extension/manifest.json` already expects.
5. **No real product screenshots exist** (QC-64) — needed for the store listing, blocked on
   having a genuinely running, installable build to screenshot.
6. **Relay persistence is in-memory only** (QC-37) — a relay restart loses all room history.
   Fine for launch if explicitly communicated, but worth deciding deliberately rather than
   discovering after a production incident.
7. **Toolbar UI, settings UI, and onboarding UI have state/controller layers built and tested
   (QC-20, QC-54, QC-60, QC-61) but no actual DOM rendering wired up yet.** The logic is ready;
   the visual components that consume it still need to be built.

## Recommended order to close these before go-live

1. ~~Generate real icon PNGs~~ — done
2. Wire up actual DOM rendering for toolbar/settings/onboarding on top of the already-tested
   state layers
3. Do the QC-23 manual browser QA pass — this is foundational, not optional polish
4. Capture real screenshots once the above makes the extension actually usable end-to-end
5. ~~Resolve the npm workspaces / duplicate-yjs issue~~ — done
6. Commission the QC-47 external audit — budget real calendar time, this shouldn't be rushed
7. Decide explicitly on relay persistence durability (accept in-memory limitation for v1, or
   invest in disk/DB-backed storage first)
8. Submit to the Firefox Add-ons store per `docs/STORE_SUBMISSION_PREP.md`

## Go/no-go recommendation

**Not ready for public launch as-is** — but closer than before. Two previously-blocking items
(icons, duplicate-dependency cleanup) are now resolved. What remains blocking: there's still no
actual rendered UI for a user to interact with (items 2–4 above are all downstream of that),
and the QC-47 audit — the thing that would let the E2EE marketing claim be made without a
qualifier — hasn't happened yet.
