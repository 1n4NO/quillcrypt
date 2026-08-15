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
- `logo/` — brand mark and lockup SVGs
- `docs/` — implementation plan, roadmap, architecture notes, privacy policy, security docs

## Status

All 67 tickets across all 5 phases in `docs/ROADMAP.md` are done. See
`docs/LAUNCH_READINESS.md` for the honest go/no-go view of what's left before public launch —
a few items (icon PNGs, real UI wired to the tested logic layers, manual browser QA, the
actual external security audit) are either just finished or still genuinely open.

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

If you haven't already:

```bash
git init
git add -A
git commit -m "Initial scaffolding"
```
