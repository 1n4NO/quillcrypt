# Quillcrypt

Collaborative, end-to-end encrypted web annotation — a Firefox extension for highlighting,
drawing, and commenting directly on any webpage with a team, without the server ever seeing
what you wrote.

## Structure

This is an npm workspaces monorepo — one root `npm install` installs and dedupes dependencies
for both packages below (this is what fixes the duplicate-`yjs`-install issue flagged during
development; see `docs/LAUNCH_READINESS.md`).

- `extension/` — the Firefox WebExtension (Manifest V3)
- `relay-server/` — thin, blind WebSocket relay for encrypted CRDT sync
- `quillcrypt-landing/` — standalone Editorial-style product landing page
- `logo/` — brand mark and lockup SVGs
- `docs/` — implementation plan, roadmap, architecture notes, privacy policy, security docs

The historical implementation plan is in `docs/ROADMAP.md`. The active release plan, including
remaining blockers and detailed acceptance criteria, is in `docs/ROADMAP_NEXT.md`. Candidate
release notes and the production launch procedure are in `docs/RELEASE_NOTES_0.1.0.md` and
`docs/LAUNCH_RUNBOOK.md`.

## Status

The implementation is release-candidate ready for automated checks, but not approved for public
launch. See `docs/LAUNCH_READINESS.md` for the remaining real-browser QA, screenshot, external
audit, relay-operations, and store-submission gates.

## Getting started

**If you have existing `node_modules/` inside `extension/` or `relay-server/` from before this
became a workspaces monorepo, remove them first** — otherwise npm won't hoist shared
dependencies correctly:

```bash
rm -rf extension/node_modules relay-server/node_modules
```

Then, from the repo root:

```bash
npm install
npm test
```

`npm test` runs both packages' test suites in sequence. Run just one with
`npm run test:extension` or `npm run test:relay`.

To build the extension for Chrome, run `npm run build:chrome --workspace=extension` and
load `extension/chrome-dist/` as an unpacked extension. The regular `npm run build:firefox
--workspace=extension` command produces the Firefox package.

The root `package.json` is the release version source. Run `npm run version:sync` when changing
versions; the browser build lifecycle also synchronizes package, manifest, and landing archive
versions. Run `npm run release:verify` after both builds to record artifact checksums.

If you haven't already:

```bash
git init
git add -A
git commit -m "Initial scaffolding"
```
