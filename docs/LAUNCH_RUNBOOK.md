# Quillcrypt launch runbook

**Status:** draft for the first public release. Fill the owner and service URLs before launch.

## Owners and public endpoints

| Responsibility | Owner | Endpoint or channel |
|---|---|---|
| Release and store submissions | _assign_ | _assign_ |
| Relay operations and backups | _assign_ | _assign_ |
| Security response | _assign_ | _assign_ |
| User support | _assign_ | _assign_ |
| Landing site | _assign_ | `https://quillcrypt.dev/` |
| Relay health | _assign_ | _assign_ |

Do not ship while any `_assign_` field is blank. A public product needs a human owner for
security reports, relay incidents, store review questions, and rollback decisions.

## Pre-launch gate

1. Set the root version and run `npm run version:sync`.
2. Run `npm test`, extension lint, both browser builds, `npm run release:verify`, and
   `npm run test:landing` from a clean working tree.
3. Complete the Chrome/Firefox checklist in `docs/BROWSER_QA.md`, including keyboard, screen
   reader, forced-colors, reduced-motion, performance, collaboration, reconnect, and console
   checks.
4. Capture redacted store screenshots from the tested artifacts. Do not use the landing
   illustration as a substitute for product screenshots.
5. Configure the relay with durable `RELAY_DATA_PATH`, authentication, exact origin allowlist,
   finite room/client/message limits, a health port, restricted file permissions, and tested
   backups. Record the restoration drill.
6. Replace the landing defaults in `quillcrypt-landing/release-config.js` with the approved
   store or release URLs. Run `npm run test:landing` again.
7. Record the release version, artifact checksums, browser versions, QA date, audit status,
   relay deployment revision, and owners in the launch decision.

## Rollback

- Disable or unpublish the bad store version and point the landing release config at the last
  known-good artifact. Preserve the current release notes and checksum record.
- Keep relay data and workspace keys intact. Roll back relay code/config separately from stored
  ciphertext; never delete history as a first response to an application regression.
- If a relay token is exposed, rotate the token, redeploy the allowlist, and review connection
  logs. A token rotation does not recover a compromised workspace key; escalate that separately.
- If ciphertext storage is lost or corrupted, stop writes, preserve the failed volume, restore a
  verified backup to a new path, and run the relay persistence tests before switching traffic.
- If a key-handling vulnerability is suspected, stop public promotion, notify the security owner,
  preserve evidence, and document affected versions before deciding on workspace key rotation.

## Incident response

| Incident | First action | Evidence to preserve |
|---|---|---|
| Relay outage | Check `/healthz`, supervisor, listener, and storage readiness | health output, deploy revision, timestamps |
| Storage loss | Stop writes and follow the backup restore procedure | failed path, backup checksum, restore log |
| Token compromise | Rotate token and tighten origin/connection limits | access logs, token rotation time |
| Abuse or resource exhaustion | Apply finite room/client/message limits and block offending origin | aggregate metrics, room counts, timestamps |
| Suspected key compromise | Stop promotion and contact security owner | affected release, audit trail, reproduction |

The relay must not log workspace keys, invite fragments, plaintext annotations, full URLs, or
payload contents while investigating any incident.

## Launch decision record

- Version: _fill_
- Firefox artifact checksum: _fill_
- Chrome artifact checksum: _fill_
- QA evidence location: _fill_
- External audit status: _fill_
- Relay revision and backup drill: _fill_
- Go/no-go owner and date: _fill_
