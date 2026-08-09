# Quillcrypt

Collaborative, end-to-end encrypted web annotation — a Firefox extension for highlighting,
drawing, and commenting directly on any webpage with a team, without the server ever seeing
what you wrote.

## Structure

- `extension/` — the Firefox WebExtension (Manifest V3)
- `relay-server/` — thin, blind WebSocket relay for encrypted CRDT sync
- `logo/` — brand mark and lockup SVGs
- `docs/` — implementation plan, roadmap, architecture notes

## Status

Pre-Phase-0. See `docs/ROADMAP.md` for the full plan, phases, and ticket breakdown before
writing any product code.

## Getting started

```bash
git init
git add -A
git commit -m "Initial scaffolding"
```

Then see `extension/README.md` and `relay-server/README.md` (once added) for per-package
setup.
