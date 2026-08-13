# Security audit scoping document

**Status:** draft, for internal review before commissioning an external audit. This is not
itself a security review — it's the scoping doc that tells an outside auditor where to spend
their time, and where not to.

## Why this matters before launch

Quillcrypt's core marketing claim is end-to-end encryption. That claim is only trustworthy if
it's been checked by someone other than the people who wrote the code. This document exists so
that check is efficient — pointing an auditor at the ~15% of the codebase where a mistake
would actually break the E2EE promise, rather than having them review everything at the same
depth.

## In scope — where a bug would break the core promise

### 1. Cryptographic primitives usage (`extension/src/crypto/`)
- `primitives.js` — is `libsodium-wrappers` used correctly? Nonce generation/reuse,
  constant-time comparison where it matters, correct primitive choice (secretbox vs. box vs.
  sealed box) for each use case.
- `keyExchange.js` / `invite.js` — does the key genuinely never leave the URL fragment? (Automated
  tests exist — QC-3/QC-43 — but an auditor should verify the test actually proves what it
  claims, not just that it passes.)
- `membership.js` / `rotation.js` — is the sealed-box wrap/unwrap flow for late-joining members
  and key rotation sound? Does rotation actually exclude a removed member from every wrapped
  copy?
- `keyStore.js` — is anything sensitive ever written to disk unencrypted, even transiently?

### 2. The sync boundary (`extension/src/sync/encryptedTransport.js`, `relay-server/`)
- The single most important file in the whole codebase for the E2EE claim: does EVERY byte
  that reaches the relay pass through encryption first, with no code path that bypasses it?
- `relay-server/src/persistentRelay.js` — does compaction (`Y.mergeUpdates`) ever need to see
  plaintext to work correctly, or does it genuinely operate on opaque ciphertext throughout?
  (Our own tests — QC-42 — check this, but an auditor should verify independently, including
  trying to break it with malformed/adversarial ciphertext, not just well-formed test data.)
- Does the relay process ever log message content, even at a debug log level not normally
  enabled in production?

### 3. Key derivation and randomness
- Is `crypto_secretbox_keygen()` (and equivalent) actually backed by a CSPRNG in every runtime
  this code ships to (Firefox content script context specifically)?
- Any place a key or nonce could be predictable, reused, or derived from low-entropy input.

### 4. Client-side attack surface
- The content script (`extension/src/content/`) runs inside **every page the user visits**,
  including actively malicious ones. What can a hostile page's own JavaScript do to the
  extension's data, given the page shares a DOM/JS environment with the content script?
  - Can page script read decrypted annotation content out of the DOM overlay?
  - Can page script trigger extension actions it shouldn't be able to (e.g. forcing an
    annotation to sync, exfiltrating a key from memory)?
  - Extension messaging (`background.js` ↔ content script) — is anything sent that a malicious
    page could intercept or spoof?

## Explicitly out of scope for this audit

- **The browser's own security sandbox** (Firefox's process isolation, extension permission
  model). We rely on it; auditing it is Mozilla's job, not ours.
- **`libsodium` itself** — auditing the underlying crypto library is out of scope; we rely on
  its own security track record and audits. Our scope is *usage* of it, not its internals.
- **Physical device security** (disk encryption, OS-level access controls). Out of scope —
  covered by the user's own device security, not this product.
- **Non-cryptographic bugs** (UI glitches, anchoring edge cases, sync race conditions that
  don't affect confidentiality) — real bugs worth fixing, but not what an *E2EE-focused
  security audit* budget should go toward. File these separately.

## Dependency supply chain — worth a lighter-weight check

- `libsodium-wrappers` and `yjs` are the two dependencies with the most access to sensitive
  data. Worth confirming: pinned versions, no unexpected transitive dependencies with broad
  permissions, and a plan for how a future CVE in either gets triaged and patched quickly.
- This project currently has **duplicate `yjs` installs** across `extension/` and
  `relay-server/` (flagged during QC-37/QC-42) — worth resolving via workspaces before audit,
  since a duplicate-instance bug is exactly the kind of thing that's hard to reason about
  during a security review.

## What "passing" looks like

The audit should produce, at minimum:
1. Confirmation (or refutation) of the core claim: an operator with full access to the relay
   server, its logs, and its persisted storage cannot recover any annotation content.
2. A specific list of any code paths that bypass encryption, even partially or under edge
   conditions (e.g. error-handling paths, retry logic, debug builds).
3. An assessment of the client-side (content script) attack surface specifically, since that's
   the piece running inside untrusted pages by design.
4. Sign-off (or a list of blocking issues) before QC-65 (privacy policy / security whitepaper)
   and QC-66 (store submission) proceed — the public-facing claims in those documents should
   not go out ahead of this review.
