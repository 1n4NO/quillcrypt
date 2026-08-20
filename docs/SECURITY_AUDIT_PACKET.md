# Quillcrypt security-audit packet

Status: prepared for an external reviewer. This packet is not an audit or a security
certification.

## Review target

Review the pinned source checkout and the generated Firefox/Chrome bundles for:

- key generation, browser storage, encrypted backup/import, invite fragments, sealed-box member
  delivery, and key rotation;
- the encrypted transport boundary and relay persistence/compaction;
- content-script behavior on hostile pages, DOM exposure, and extension messaging;
- extension permissions, generated manifests, and bundle contents.

The threat model and detailed file map are in [SECURITY_AUDIT_SCOPE.md](SECURITY_AUDIT_SCOPE.md).
The operational relay contract is in [RELAY_OPERATIONS.md](RELAY_OPERATIONS.md).

## Reproduction commands

From a clean checkout:

```sh
npm ci
npm test
npm run build:firefox --workspace=extension
npm run build:chrome --workspace=extension
```

The reviewer should inspect the generated archives and unpacked Chrome directory after the
build, not only the source modules. `verify-bundles.mjs` rejects unresolved Node-only runtime
imports and Buffer usage in browser bundles.

## Evidence already available

- invite tests prove keys stay in URL fragments and out of request targets;
- encrypted relay tests inspect live traffic and persisted history for plaintext leakage;
- restart tests prove opaque file-backed history reloads;
- key-backup tests cover encryption envelope creation, wrong passwords, malformed passwords, and
  round-trip restoration;
- membership/rotation tests prove removed members receive no newly wrapped key;
- operational relay tests cover authorization hooks, health readiness, rate limits, client limits,
  and graceful shutdown behavior;
- Chrome and Firefox builds run bundle verification.

## Required external conclusions

The reviewer must independently determine whether the relay operator can recover annotation
content, whether hostile page scripts can extract or trigger sensitive content-script behavior,
and whether crypto usage and key lifecycle choices are sound. No public claim should describe the
product as externally audited until a signed report and remediation record exist.

## Known limitations to review explicitly

- content scripts intentionally run in the page's DOM environment;
- file-backed relay persistence is single-process JSON storage, not a multi-process database;
- backups are locally encrypted with a user password, and losing that password is irreversible;
- removing a member rotates future access but does not erase content that member already decrypted;
- the extension requests `<all_urls>` because annotation activation is page-wide by design.
