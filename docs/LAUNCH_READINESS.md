# QC-67 — Launch readiness checklist

**Purpose:** a single honest go/no-go view before shipping. This pulls together every
outstanding item flagged across the whole roadmap — nothing here is new, it's a consolidation.

## Engineering — done and automated-tested

Everything in Phases 0–4 is built and covered by automated tests: 306 passing tests across
`extension/` and `relay-server/` as of Phase 5 (run `cd extension && npm test` and
`cd relay-server && npm test` to confirm current counts). This includes the core E2EE claim,
verified against the relay's actual persisted storage, not just asserted.

## Explicitly NOT done — read this before deciding to launch

These are real, previously-flagged gaps. Shipping without resolving them means shipping with
these specific risks accepted, not unknown:

1. **QC-23's manual real-browser QA has not been performed.** Scroll/resize/zoom/lazy-load
   behavior for the SVG overlay is verified only at the logic level (jsdom has no layout
   engine). This needs an actual person, in actual Firefox, on an actual long page, before
   Phase 1 can be considered truly exited — not just Phase 5.
2. **QC-47's security audit is scoped, not performed.** `docs/SECURITY_AUDIT_SCOPE.md` tells an
   auditor where to look; no external party has actually reviewed the code yet. The public
   privacy policy (`docs/PRIVACY_POLICY.md`) already says this plainly — don't quietly remove
   that caveat before an audit actually happens.
3. **Duplicate `yjs` installs** across `extension/` and `relay-server/` (flagged at QC-37 and
   QC-42) — triggers a "Yjs was already imported" warning. Nothing has broken yet, but this is
   exactly the kind of latent issue worth fixing via npm/yarn workspaces before it causes a
   harder-to-diagnose bug post-launch.
4. **Extension icons are still SVG-only.** `extension/manifest.json` references PNG files
   (`icon-16.png`, `icon-48.png`, `icon-128.png`) that don't exist yet as real files — only
   `logo/quillcrypt-mark.svg` exists. These need to be generated before the extension can even
   load with proper icons, let alone be submitted to the store.
5. **No real product screenshots exist** (QC-64) — needed for the store listing, blocked on
   having a genuinely running, installable build to screenshot.
6. **Relay persistence is in-memory only** (QC-37) — a relay restart loses all room history.
   Fine for launch if explicitly communicated, but worth deciding deliberately rather than
   discovering after a production incident.
7. **Toolbar UI, settings UI, and onboarding UI have state/controller layers built and tested
   (QC-20, QC-54, QC-60, QC-61) but no actual DOM rendering wired up yet.** The logic is ready;
   the visual components that consume it still need to be built.

## Recommended order to close these before go-live

1. Generate real icon PNGs (quick — five minutes of work, already offered earlier)
2. Wire up actual DOM rendering for toolbar/settings/onboarding on top of the already-tested
   state layers
3. Do the QC-23 manual browser QA pass — this is foundational, not optional polish
4. Capture real screenshots once the above makes the extension actually usable end-to-end
5. Resolve the npm workspaces / duplicate-yjs issue — lower urgency, but do it before it bites
6. Commission the QC-47 external audit — budget real calendar time, this shouldn't be rushed
7. Decide explicitly on relay persistence durability (accept in-memory limitation for v1, or
   invest in disk/DB-backed storage first)
8. Submit to the Firefox Add-ons store per `docs/STORE_SUBMISSION_PREP.md`

## Go/no-go recommendation

**Not ready for public launch as-is.** The engineering foundation is unusually solid for this
stage — genuinely verified E2EE, real concurrent-editing stress tests, a relay that's been
caught and fixed for real bugs along the way. But items 1-2 and 4-5 above are blocking in the
literal sense (the extension doesn't have real icons or a renderable UI yet), and item 2 (the
actual audit) is blocking for anyone who takes the E2EE marketing claim seriously, which is
presumably the whole point of the product.
