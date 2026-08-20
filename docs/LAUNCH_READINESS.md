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

0. ~~**Live entry points are only partially composed.**~~ — **RESOLVED FOR THE CURRENT
   PRODUCT SLICE.** `content-script.js` now mounts local annotations, workspace selection,
   encrypted workspace sessions, presence, settings, onboarding, member management, sidebar
   retry behavior, and the browser lifecycle. The background entry point provides status and
   settings messaging. Remaining uncertainty is runtime/browser evidence, not an unconnected
   implementation path.

1. **QC-23's manual real-browser QA has not been performed.** The built Chrome and Firefox
   artifacts are now available; install, collaboration, accessibility, performance, and console
   checks remain release gates.

2. **QC-47's security audit is scoped, not performed.** `docs/SECURITY_AUDIT_SCOPE.md` tells an
   auditor where to look; no external party has actually reviewed the code yet. The public
   privacy policy (`docs/PRIVACY_POLICY.md`) already says this plainly — don't quietly remove
   that caveat before an audit actually happens.

3. ~~**Duplicate `yjs` installs**~~ — **RESOLVED.** npm workspaces monorepo; verified the
   "already imported" warning is genuinely gone by re-running a cross-package sync test under
   the new structure.

4. ~~**Extension icons are still SVG-only.**~~ — **RESOLVED.** Real PNG icons generated and
   placed at `extension/icons/`.

5. **No real product screenshots exist** (QC-64) — blocked on the manual browser QA pass and
   the need to capture truthful, redacted product states.

6. **Relay persistence is now file-backed when `RELAY_DATA_PATH` is configured** — histories
   survive a relay restart and remain opaque base64-encoded bytes on disk. Optional bearer auth,
   origin checks, payload/rate/room limits, heartbeat pruning, health checks, and graceful
   shutdown are now available. Retention limits, backups, structured logs, and a formal
   deployment policy still need production hardening.

7. ~~**No DOM rendering wired up for toolbar/settings/onboarding.**~~ — **RESOLVED.** The three
   UI components are mounted by the live content script and covered by tests:
   - `extension/src/ui/toolbarView.js` — 21/21 tests
   - `extension/src/ui/settingsView.js` — 11/11 tests
   - `extension/src/ui/onboardingView.js` — 5/5 tests

   Real browser behavior still needs to be observed and recorded separately from component tests.

8. **Chrome support** now has a build path (`npm run build:chrome --workspace=extension`) and a
   Chrome MV3 manifest in `extension/manifest.chrome.json`. It still needs real Chrome unpacked
   install/smoke verification and store packaging before it can be called supported.

## Recommended order to close what's left

1. Do the QC-23 manual browser QA pass for Chrome and Firefox
2. Capture real screenshots and store evidence
3. Commission the QC-47 external audit
4. Decide explicitly on relay retention, backups, and deployment policy
5. ~~Harden the landing-page download/store links~~ — **LOCAL IMPLEMENTATION COMPLETE.**
   `quillcrypt-landing/` now has release-aware CTAs, privacy/canonical metadata, a local asset
   verifier, and deployment-owned store URLs. Real store URLs and browser evidence remain launch gates.
6. Submit to browser stores per `docs/STORE_SUBMISSION_PREP.md`

## Go/no-go recommendation

**Not ready for public launch.** The core extension and landing implementation are connected and
automated-tested, but real browser/accessibility/performance evidence, an external security audit,
store screenshots, production relay policy, and store operations remain before a public release.
