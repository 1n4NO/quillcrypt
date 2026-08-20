# Quillcrypt 0.1.0 release candidate

**Status:** private release candidate. This is not yet a public store release.

## What is included

- Highlight, underline, note, freehand, arrow, rectangle, and ellipse annotations.
- Local persistence with reload, undo, redo, edit, delete, and export flows.
- Workspace-scoped collaboration through an encrypted relay session.
- Invite links, workspace membership, key rotation, encrypted key backup/import, and member
  fingerprint/removal controls.
- Chrome MV3 and Firefox MV3 build/package paths.
- A privacy-first landing page with release-aware browser download links.

## Supported build targets

- Firefox 115 or newer, based on `strict_min_version` in the Firefox manifest.
- Chrome/Chromium 110 or newer, based on the bundle target and MV3 manifest path.

These are build targets, not a completed compatibility claim. The real-browser matrix in
`docs/BROWSER_QA.md` must be signed before public support is announced.

## Privacy and security status

Annotation content is encrypted in the browser before relay transport. Automated tests verify
that relay traffic and file-backed history do not contain readable annotation content. The
external security audit is scoped but not complete; public copy must retain that distinction.

The relay requires an explicit production configuration for durable storage, authentication,
origin allowlisting, finite limits, health checks, backups, and retention policy. See
`docs/RELAY_OPERATIONS.md`.

## Known limitations before public launch

- Manual Chrome/Firefox install, accessibility, performance, and collaboration QA is open.
- Store screenshots and redacted product evidence are not included in this repository.
- Real store/release URLs must replace the deployment-owned defaults in
  `quillcrypt-landing/release-config.js`.
- Store submission, external security review, support ownership, and production relay operations
  remain account/deployment actions.

## Reproduce the candidate artifacts

```sh
npm install
npm test
npm run lint --workspace=extension
npm run build:firefox --workspace=extension
npm run build:chrome --workspace=extension
npm run release:verify
```

The root `package.json` is the version source. The build lifecycle synchronizes the extension
package, browser manifests, and landing archive URLs before packaging. `release:verify` writes
the ignored artifact checksum file under `extension/web-ext-artifacts/` and rejects unexpected
payload files. The archive writer uses fixed timestamps and sorted entries so repeated builds
produce stable checksums.
