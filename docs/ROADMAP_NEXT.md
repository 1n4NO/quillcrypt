# Quillcrypt next roadmap

This is the implementation roadmap from the repository's current state. `docs/ROADMAP.md`
remains the historical record of the original QC-1 through QC-67 plan; this document is the
release-oriented follow-up for the work that is still incomplete or only verified in isolation.

## Current read

The project has a strong, tested core:

- anchoring, local annotation tools, SVG overlays, storage adapters, Yjs sync, encryption,
  membership, key rotation, exports, integrations, onboarding logic, and settings logic are
  implemented and covered by automated tests;
- valid extension icons now exist;
- browser bundles are generated with esbuild;
- Firefox and Chrome packaging paths exist;
- the standalone Editorial landing page exists in `quillcrypt-landing/`.

The product is not ready to ship publicly because real-browser evidence, external security review,
store screenshots, and store submission are outstanding. The live content script now composes local
annotation, workspace selection, encrypted sync, presence, settings, onboarding, member management,
and the background lifecycle. The relay has file-backed persistence and operational safeguards;
production retention, backups, and deployment policy still need explicit decisions.

## Delivery gates

| Gate | Meaning | Must be true before moving on |
|---|---|---|
| G0 | Reproducible builds | A clean checkout can install, test, lint, and build both browser artifacts |
| G1 | Usable single-user extension | A person can install the extension and annotate/reload/undo/delete on real Chrome and Firefox pages |
| G2 | Usable encrypted collaboration | Two users can join the same workspace, sync encrypted annotations, reconnect, and manage membership |
| G3 | Security and durability | Relay restart behavior is deliberate, storage is durable, and an external audit has no unresolved blocker |
| G4 | Public launch | Accessibility, performance, store assets, landing CTAs, release notes, and submission readiness are complete |

Tickets use `QC-NEXT-###` identifiers so they cannot be confused with the completed historical
QC-1 through QC-67 sequence. Estimates are S = about one day, M = two to three days, and L =
about one week or more.

## Phase 0 - Baseline and release contract

Goal: make the current state measurable and stop the documentation/build configuration from
drifting away from what users can actually install.

### QC-NEXT-001 - Reconcile roadmap and launch status *(Task, S)*

**Problem:** `docs/ROADMAP.md` says all five phases are complete, while `docs/LAUNCH_READINESS.md`
correctly says the product is not launch-ready. This creates false completion signals.

**Work:** mark historical tickets as logic-complete versus browser-verified, link this roadmap
from the README and launch checklist, and define one authoritative launch status.

**Acceptance criteria:**

- the README, historical roadmap, next roadmap, and launch checklist agree on the current gate;
- every remaining launch blocker has one owner-facing ticket here;
- no ticket is called “done” when only a jsdom or isolated-module test exists.

### QC-NEXT-002 - Reproducible CI matrix *(Task, M)*

**Problem:** validation currently depends on locally installed dependencies and does not prove
that the Chrome artifact, Firefox artifact, and landing page all build from a clean checkout.

**Work:** add CI jobs for Node LTS, `npm ci`, full tests, Firefox lint/build, Chrome build, archive
inspection, and landing-page static checks. Cache dependencies only after the clean install path
works.

**Acceptance criteria:**

- a clean CI runner passes `npm ci` and `npm test`;
- Firefox lint/build and Chrome build run in separate jobs;
- CI fails if a manifest points to a missing file, a PNG is invalid, or a bundle still contains
  an unresolved Node-only runtime import;
- the landing page has no broken local asset links.

**Depends on:** QC-NEXT-003.

### QC-NEXT-003 - Dependency and audit baseline *(Task, M)*

**Problem:** `npm audit` currently reports 11 vulnerabilities, mostly through the `web-ext`
toolchain, and the project has no documented policy for transitive development-tool findings.

**Work:** inventory runtime versus development dependencies, upgrade `web-ext` and related tools
where compatible, document accepted residual findings, and add an audit command to CI without
silently applying breaking `--force` upgrades.

**Acceptance criteria:**

- runtime dependencies have no known high or critical vulnerability without an explicit waiver;
- every remaining development-only finding has a package path, severity, reason, and review date;
- no audit remediation changes the browser runtime bundle unexpectedly;
- the lockfile is committed and `npm ci` is reproducible.

## Phase 1 - Live browser runtime

Goal: make the extension a real, installable single-user product in Chrome and Firefox.

### QC-NEXT-010 - Stabilize cross-browser build targets *(Task, M)*

**Problem:** Chrome and Firefox require different MV3 background declarations. The repository
now has separate manifests and generated Chrome output, but this path needs release-grade checks.

**Work:** define `build:chrome` and `build:firefox` as supported commands, copy only required
assets into each artifact, validate both manifests, and document unpacked installation.

**Acceptance criteria:**

- Chrome artifact contains a service worker manifest and loads as unpacked in Chrome;
- Firefox artifact contains the Gecko metadata and background scripts manifest;
- both artifacts contain bundled content/background files, CSS, icons, and no test files;
- version, name, permissions, and host matches are consistent across artifacts.

**Status:** partially implemented; build paths exist, real browser loading remains.

### QC-NEXT-011 - Browser runtime API audit *(Task, M)*

**Problem:** source modules use CommonJS and some Node-oriented APIs. Bundling solves the current
content-script entry point, but future wiring can reintroduce browser failures, especially around
`crypto`, `fetch`, `WebSocket`, `browser`, and `chrome` globals.

**Work:** classify every module reachable from each entry point, replace Node-only APIs with Web
Crypto or browser APIs, and add a bundle smoke test that evaluates the generated entry points in
a browser-like environment.

**Acceptance criteria:**

- Chrome and Firefox bundles contain no unresolved `require`, `process`, `Buffer`, or Node-only
  builtin dependency unless deliberately polyfilled;
- crypto uses Web Crypto/libsodium browser-compatible paths;
- storage and extension APIs work through one explicit browser API adapter;
- a generated bundle can execute its entry-point initialization without a console exception.

**Status:** substantially implemented for the current entry points; the bundle verifier now
rejects Node builtin requires and Buffer usage in generated Chrome and Firefox artifacts. A real
browser smoke run is still required.

### QC-NEXT-012 - Complete content-script composition *(Story, L)*

**Problem:** the current content script handles local annotation only. It does not choose a
  workspace, create an encrypted sync document, connect presence, or render remote updates.

**Work:** compose workspace matching, key lookup, encrypted transport, `SyncClient`, presence,
  Yjs annotation observation, local fallback, reconnect handling, and disposal into one lifecycle.
  Do not connect until the relay URL and workspace state are explicit.

**Acceptance criteria:**

- page load selects the correct workspace(s) without activating unrelated workspaces;
- local annotation writes update the Yjs document and render once, without duplicate DOM marks;
- remote encrypted updates render in the current page;
- reconnect and tab teardown dispose every WebSocket, observer, listener, and timer;
- a missing workspace key produces an actionable join/unlock state, not a silent failure;
- no decrypted content is sent to integrations or the relay.

**Depends on:** QC-NEXT-011, QC-NEXT-020, QC-NEXT-021.

**Status:** first runtime slice implemented. Matching workspaces with a stored key and configured
relay now create an encrypted `WorkspaceSession`, sync annotations and presence, render remote
changes, mirror them to local storage, and dispose transports on teardown. Workspace creation,
join/unlock UI, and actionable missing-key states remain for QC-NEXT-020 and QC-NEXT-014.

### QC-NEXT-013 - Background lifecycle and extension messaging *(Story, M)*

**Problem:** the background entry point is still a minimal lifecycle scaffold. Settings, action
  clicks, workspace changes, and future sync coordination have no real extension-level contract.

**Work:** define typed message names and handlers for opening settings, reading active workspace
  state, join-link handling, and safe shutdown. Keep keys out of logs and do not move plaintext
  annotation content through background messages unless the design explicitly requires it.

**Acceptance criteria:**

- the service worker/background script starts cleanly in Chrome and Firefox;
- action click opens the intended UI surface;
- unknown messages are rejected safely;
- message payloads are schema-validated and contain no raw annotation content or group keys in
  logs;
- lifecycle tests cover worker restart and duplicate messages.

**Status:** partially implemented. A shared message contract now validates `PING`, status,
relay-state, and settings-open requests; the background entry point registers the handler and
forwards the browser action to the active tab. Settings UI mounting and worker-restart coverage
remain for the next slice.

### QC-NEXT-014 - Real UI mounting: settings, sidebar, and onboarding *(Story, M)*

**Problem:** toolbar and onboarding are mounted by the content script, but settings and the
  annotation sidebar are still tested components rather than complete product surfaces.

**Work:** mount settings from the action/background route, mount the sidebar from the page toolbar,
  connect member/scoping controls to real storage, and add close/focus behavior.

**Acceptance criteria:**

- a user can open settings, inspect workspaces and key state, export, and leave a workspace;
- a user can open the page sidebar, filter annotations, select an item, and jump to its anchor;
- onboarding dismiss/completion state survives extension reload;
- all surfaces clean up on close and do not duplicate after reinjection.

**Depends on:** QC-NEXT-013.

**Status:** sidebar and settings slices implemented. The page toolbar now opens a real, filterable
annotation panel with anchor jumping and disposal; local and live-session updates keep its list
current. The action-click message now opens a real settings panel backed by workspace and key
storage. Member/scoping controls and export wiring remain.

### QC-NEXT-015 - Single-user real-browser smoke suite *(Task, M)*

**Problem:** jsdom cannot verify layout, selection behavior, scroll anchoring, page zoom,
  iframes, lazy content, or browser extension API behavior.

**Work:** define a fixture page and run manual or automated smoke checks in Chrome and Firefox.

**Acceptance criteria:**

- install and reload work in both browsers;
- highlight and underline survive text selection and page reload;
- draw, arrow, rectangle, ellipse, and note tools work on a long scrolling page;
- undo, redo, edit, delete, and sidebar selection work;
- overlay survives scroll, resize, zoom, late DOM mutations, and a hostile high-z-index sibling;
- no uncaught console errors occur.

**Depends on:** QC-NEXT-010 through QC-NEXT-014.

## Phase 2 - Encrypted collaboration product

Goal: turn the tested sync and crypto modules into an intentional user flow.

### QC-NEXT-020 - Workspace creation, join, and active-workspace UX *(Story, L)*

**Problem:** workspace, invite, key, and scope logic exists, but there is no complete UI flow that
  creates a workspace, accepts an invite, unlocks a key, and activates it on matching pages.

**Work:** build create/join flows, scope preview, invite confirmation, malformed-link states,
  duplicate workspace handling, and active-workspace selection.

**Acceptance criteria:**

- inviter can create a domain or URL-list workspace and copy an invite;
- invitee sees workspace name/scope before accepting;
- key remains in the URL fragment and never enters query/path or relay requests;
- accepting an invite stores the correct workspace id/key and activates the same room;
- cancel, invalid, expired, and already-joined states are clear and recoverable.

### QC-NEXT-021 - Wire encrypted SyncClient and PresenceClient *(Story, L)*

**Problem:** the encrypted transport is tested in isolation but is not used by the real extension.

**Work:** instantiate sync/presence only for an active unlocked workspace, derive room ids from
  workspace identity, and bridge Yjs changes to the renderer.

**Acceptance criteria:**

- two real browser profiles can annotate the same page and converge;
- relay traffic and persisted entries contain ciphertext only;
- wrong-key and decrypt-error states do not crash or leak content;
- offline edits and updates made by another client while offline catch up after reconnect;
- presence is opt-in or clearly disclosed and is disposed on tab close.

**Depends on:** QC-NEXT-012, QC-NEXT-020.

### QC-NEXT-022 - Durable relay persistence *(Story, L)*

**Problem:** `persistentRelay.js` persists room history only in memory. A process restart loses
  all offline catch-up history.

**Work:** choose and implement a disk/database-backed opaque update store. Preserve room
  isolation, compaction, bounded storage, and encrypted-at-rest assumptions appropriate to the
  relay's blind design.

**Acceptance criteria:**

- restart the relay and a previously offline client still catches up;
- updates are stored/retrieved as opaque ciphertext bytes;
- compaction survives restart and cannot corrupt a room;
- storage has size limits, retention policy, and recovery behavior;
- concurrent writers and shutdown do not lose acknowledged updates.

**Depends on:** QC-NEXT-021.

**Status:** file-backed persistence is implemented behind `RELAY_DATA_PATH`. Room histories
are loaded at startup and atomically replaced after each opaque update/compaction; unset
configuration retains in-memory development mode. Database-backed retention limits and backup
operations remain future hardening work.

### QC-NEXT-023 - Relay production hardening *(Task, M)*

**Problem:** the relay has room isolation and peer-failure tests but no production contract for
  authentication, abuse limits, observability, or graceful shutdown.

**Work:** define deployment configuration, origin/auth policy, max frame size, max room/client
  counts, rate limits, heartbeat behavior, health endpoint, structured redacted logs, and signal
  handling.

**Acceptance criteria:**

- unauthenticated or unauthorized room access is rejected according to the product policy;
- oversized frames and connection floods are bounded;
- logs contain room/client identifiers only in redacted or hashed form and never plaintext;
- health/readiness signals cover storage and relay availability;
- graceful shutdown drains or clearly rejects new connections without corrupting persisted state.

**Status:** the production entry point now supports optional bearer-token authorization, origin
allowlisting, maximum frame size, room/client limits, per-connection rate limits, heartbeat
pruning, a separate redacted `/healthz` endpoint, and graceful signal-driven draining through
environment/configuration options. Structured redacted logs and a formal deployment policy
remain.

## Phase 3 - Security, privacy, and trust

Goal: make the public privacy and E2EE claims match independently reviewed behavior.

### QC-NEXT-030 - External cryptography and content-script audit *(Task, L)*

**Problem:** `docs/SECURITY_AUDIT_SCOPE.md` is a scope document, not an audit. The content script
  runs inside untrusted pages and is the highest-risk integration surface.

**Work:** commission an external review covering key generation/storage, invite fragments,
  sealed-box membership, rotation, encrypted transport, relay persistence, content-script DOM
  boundaries, extension permissions, and bundle outputs.

**Acceptance criteria:**

- auditor receives a pinned build, threat model, scope, and reproducible test instructions;
- all critical/high findings are fixed or explicitly accepted by the product owner;
- regression tests cover every fixed finding;
- privacy copy clearly distinguishes audited claims from unaudited claims;
- audit report and remediation status are retained in project documentation.

**Depends on:** QC-NEXT-011, QC-NEXT-022, QC-NEXT-023.

**Status:** the audit packet, reproducible commands, evidence map, known-limitations list, and
permissions/data-handling rationale are prepared. External review and remediation sign-off are
still required before the product can claim an audit.

### QC-NEXT-031 - Key lifecycle and recovery UX *(Story, M)*

**Problem:** key-store and recovery logic exists, but users need a safe operational flow for
  backup, device loss, member removal, and leaving a workspace.

**Work:** expose encrypted export/import, fingerprint confirmation, re-authentication or explicit
  confirmation for destructive membership actions, and clear recovery warnings.

**Acceptance criteria:**

- backup export is clearly labeled sensitive and never sent automatically;
- import validates format/version and refuses malformed or mismatched workspace data;
- member removal shows rotation consequences and confirms the target member;
- leaving a workspace removes local keys and explains what remains on other devices;
- no plaintext key or annotation content is logged.

**Status:** encrypted, versioned workspace-key backup/export and password-validated import are
implemented in Settings. Backups use PBKDF2-SHA-256 plus AES-GCM locally and never leave the
device; member fingerprint confirmation and destructive member-rotation UI are now available in
the Settings member subview when a workspace member controller is supplied.

### QC-NEXT-032 - Permissions and data-collection review *(Task, M)*

**Problem:** the extension requests broad host access and the Firefox linter reports a future
  data-collection-permissions requirement. The user-facing rationale needs to match actual code.

**Work:** minimize permissions where possible, document why content scripts and storage need each
  permission, add the browser-specific declaration when required, and verify store disclosures.

**Acceptance criteria:**

- every permission has a code reference and plain-language rationale;
- no permission is retained solely for an unused feature;
- Firefox and Chrome store declarations match runtime behavior;
- linter notices are resolved or tracked with a dated compatibility decision.

**Status:** permission and data-handling rationale is documented in `docs/PERMISSIONS_AND_DATA.md`.
The current broad host access remains intentional for arbitrary-page annotation and still needs
browser-store review and a dated compatibility decision for any future data-collection notices.

## Phase 4 - UX, accessibility, and resilience

Goal: verify the product in real browsers for real people and real pages.

### QC-NEXT-040 - Manual accessibility and screen-reader QA *(Task, M)*

**Problem:** accessibility logic and ARIA labels are unit-tested, but focus order, keyboard traps,
  contrast, live announcements, and VoiceOver/NVDA behavior are not.

**Work:** run a keyboard-only and screen-reader pass on Chrome and Firefox, test reduced motion,
  zoom to 200%, forced colors, and focus restoration after panels close.

**Acceptance criteria:**

- every interactive control is reachable and has an understandable accessible name;
- focus is visible, trapped only when appropriate, and restored after dialogs/panels close;
- tool selection, annotation creation, and errors are announced meaningfully;
- color contrast and non-color states pass WCAG AA targets;
- reduced-motion and high-zoom layouts remain usable.

**Status:** sidebar orphan states, focus restoration, live status messaging, forced-colors and
reduced-motion styles are implemented and tested. Real keyboard, screen-reader, contrast, and
high-zoom verification remains tracked in `docs/BROWSER_QA.md`.

### QC-NEXT-041 - Anchoring and hostile-page resilience *(Story, M)*

**Problem:** anchoring has documented failure modes, while arbitrary pages can mutate, virtualize,
  shadow DOM, change layout, or remove the quoted text.

**Work:** define graceful orphaned-annotation UI, retry after lazy/SPA mutations, observe route
  changes, and test pages with long text, duplicate quotes, virtualized content, and aggressive DOM
  scripts.

**Acceptance criteria:**

- unlocatable annotations appear in the sidebar as orphaned with an explanation and recovery path;
- the renderer never silently drops or duplicates an annotation;
- route changes and late content trigger bounded, debounced re-anchoring;
- shadow DOM/iframe behavior is explicitly supported or clearly excluded in product copy;
- mutation observers are disconnected and bounded to avoid page performance regressions.

**Status:** orphaned annotations are surfaced with retry actions; debounced retries now respond to
relevant late DOM mutations and SPA history/hash routes, and restore all patched listeners on
teardown. Hostile-page and real-browser coverage remains in `docs/BROWSER_QA.md`.

### QC-NEXT-042 - Real-browser performance budget *(Task, M)*

**Problem:** current performance numbers are Node benchmarks, not browser measurements on real
  pages.

**Work:** profile cold load, 5,000 annotations, long freehand paths, scroll/resize, mutation
  bursts, sync bursts, and storage writes in Chrome and Firefox.

**Acceptance criteria:**

- extension startup adds a documented maximum overhead on a representative page set;
- scroll and resize remain within the chosen frame-time budget;
- annotation rendering is batched and does not duplicate DOM wrappers;
- memory does not grow without bound after repeated page navigation/reinjection;
- performance findings produce either fixes or explicit supported-page limits.

**Status:** browser measurement scenarios and evidence requirements are documented in
`docs/BROWSER_QA.md`; real profiling is still a manual release gate.

### QC-NEXT-043 - Browser compatibility and release regression suite *(Task, M)*

**Problem:** browser support is split across manifests, but there is no repeatable matrix for
  Chrome/Firefox versions, page types, zoom, locale, or extension reload.

**Work:** define supported versions, fixture pages, smoke scenarios, and a release checklist.

**Acceptance criteria:**

- supported Chrome and Firefox versions are stated in docs and manifests;
- release smoke covers install, update, reload, uninstall/reinstall, and storage migration;
- browser-specific failures are tagged with a clear adapter or manifest owner;
- every release candidate has a tested artifact checksum.

**Status:** Chrome/Firefox artifact commands and a release smoke matrix are documented in
`docs/BROWSER_QA.md`; actual browser runs and checksum recording remain outstanding.

## Phase 5 - Landing page and public launch

Goal: make the public-facing product truthful, usable, and submission-ready.

### QC-NEXT-050 - Landing page production hardening *(Task, M)*

**Problem:** the landing page is a standalone visual prototype. Its CTAs currently show a
  “Coming soon” interaction instead of downloading a real artifact, and its font import depends
  on an external Google Fonts request.

**Work:** connect CTAs to versioned release URLs, add favicon/OG/Twitter metadata, self-host or
  provide a deliberate font fallback, verify all assets under the deployment root, and add a
  privacy/contact destination.

**Acceptance criteria:**

- Chrome and Firefox buttons download the intended release artifact or point to a real store page;
- no CTA is a dead-end demo interaction in production;
- page has title, description, canonical URL, Open Graph image, favicon, and accessible headings;
- the page renders without external font availability and does not shift layout when fonts load;
- all local links and assets work when deployed from the intended host root.

**Status:** local production hardening is implemented. CTAs use versioned Chrome/Firefox archive
fallbacks, can be switched to real store URLs through `quillcrypt-landing/release-config.js`,
and the landing verifier checks metadata assets, local references, demo CTA removal, and the
no-external-font guarantee. The deployment-owned store URLs and real-browser evidence remain
release gates.

### QC-NEXT-051 - Store screenshots and product evidence *(Task, M)*

**Problem:** store copy exists, but no real product screenshots exist because the live extension
  has not completed browser QA.

**Work:** capture real Chrome and Firefox screenshots for first install, highlight/note/draw,
  collaborative state, settings, and privacy explanation. Redact any real user/page data.

**Acceptance criteria:**

- screenshots show the actual built extension, not a mockup;
- screenshots cover the store-required sizes and localization rules;
- no secrets, private URLs, personal data, or misleading states appear;
- landing page preview imagery is either a real screenshot or clearly labeled product illustration.

**Depends on:** QC-NEXT-015, QC-NEXT-020, QC-NEXT-040.

### QC-NEXT-052 - Release artifact and versioning workflow *(Task, M)*

**Problem:** version is duplicated across package and manifests, and artifacts are generated
  locally without a release manifest or checksum record.

**Work:** define one version source, release notes, artifact naming, checksums, reproducible build
  instructions, and a clean artifact directory policy.

**Acceptance criteria:**

- package/manifests/landing download URLs receive one consistent version;
- Chrome and Firefox artifacts include build metadata and checksums;
- generated artifacts are excluded from source when appropriate and can be recreated exactly;
- release notes state known limitations, relay durability, audit status, and supported browsers.

**Depends on:** QC-NEXT-002, QC-NEXT-010.

**Status:** implemented for the 0.1.0 candidate. The root `package.json` is the version source;
`npm run version:sync` and the build lifecycle synchronize the extension package, browser
manifests, and landing archive URLs. Firefox and Chrome builds produce versioned archives,
`npm run release:verify` records SHA-256 checksums and rejects unexpected archive contents. The
archive writer uses sorted files and fixed ZIP timestamps so repeated builds are checksum-stable.
`docs/RELEASE_NOTES_0.1.0.md` records known limitations and supported build targets. A future
release still needs its own notes, QA evidence, and store URLs.

### QC-NEXT-053 - Store submission and launch operations *(Task, M)*

**Problem:** store submission preparation exists, but actual submission, review response, relay
  deployment, support, and rollback procedures do not.

**Work:** submit to the Firefox Add-ons store, prepare Chrome Web Store materials, document relay
  deployment, create incident/rollback runbooks, and define a support channel.

**Acceptance criteria:**

- store submissions use artifacts that passed G0-G4 checks;
- reviewer questions about host access, relay traffic, and E2EE have evidence-backed answers;
- rollback can disable a bad release without deleting user data or keys;
- relay incident response covers key compromise, storage loss, abuse, and outage;
- launch decision is recorded with explicit owners for remaining non-blocking risks.

**Depends on:** QC-NEXT-030, QC-NEXT-050 through QC-NEXT-052.

**Status:** `docs/LAUNCH_RUNBOOK.md` now covers owners, pre-launch gates, rollback, incident
response, and the launch decision record. Store submission, account ownership, relay deployment,
and support assignment remain manual launch actions.

## Phase 6 - Post-launch hardening

These tickets should not block a private beta but should be scheduled before broad adoption.

### QC-NEXT-060 - Durable migration and backup verification *(Story, M)*

Test browser storage migrations, relay database backups/restores, workspace export recovery, and
version upgrades with real data fixtures.

**Status:** opaque relay backup/restore is implemented with snapshot validation, atomic writes,
CLI access through `npm run backup --workspace=relay-server`, and a restart/replay test. Browser
storage/key-backup/export coverage exists in the extension suite. Real beta upgrade fixtures and
scheduled backup/retention drills remain operational work.

### QC-NEXT-061 - Operational observability without content leakage *(Task, M)*

Add health metrics, error tracking, and performance telemetry that explicitly excludes page text,
annotation content, keys, invite fragments, full URLs, and decrypted payloads.

**Status:** the health endpoint and an optional aggregate-only `onMetric` hook are implemented
and tested against sensitive-field leakage. A production metrics backend, error tracking, and
performance telemetry policy still need deployment ownership.

### QC-NEXT-062 - Product feedback and scope review *(Task, S)*

Review orphaned anchors, workspace scope confusion, relay costs, browser-specific issues, and
accessibility findings from beta users. Convert evidence into the next ticket set rather than
expanding scope opportunistically.

**Status:** pending beta evidence; no synthetic findings are being promoted into product scope.

## Recommended execution order

1. QC-NEXT-001 through QC-NEXT-003: establish the truthful, reproducible baseline.
2. QC-NEXT-010 through QC-NEXT-015: make local annotation reliable in real Chrome and Firefox.
3. QC-NEXT-020 through QC-NEXT-023: connect collaboration and harden the relay.
4. QC-NEXT-030 through QC-NEXT-032: complete trust, permissions, and audit readiness.
5. QC-NEXT-040 through QC-NEXT-043: finish accessibility, resilience, performance, and support.
6. QC-NEXT-050 through QC-NEXT-053: ship the landing page, artifacts, store assets, and launch.
7. QC-NEXT-060 through QC-NEXT-062: harden after beta evidence arrives.

## Explicit non-goals for this release

- Chrome and Firefox parity does not imply Safari support.
- The relay does not receive plaintext annotation content.
- Forward secrecy for content already decrypted by a removed member is not provided by the
  current group-key rotation design.
- Shadow DOM and cross-origin iframe annotation support should remain excluded until a separate
  anchoring design exists.
- Key escrow is not introduced without a separate threat-model and product decision.
