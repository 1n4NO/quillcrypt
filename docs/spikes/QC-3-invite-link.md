# QC-3 — Spike: invite-link key exchange

**Status: done.** Implementation at `extension/src/crypto/keyExchange.js`,
tests at `extension/test/keyExchange.test.js` (6/6 passing).

## Approach

Generate a workspace symmetric key client-side with `libsodium.crypto_secretbox_keygen()`,
encode it URL-safe base64, and place it in the invite link's **fragment**
(`https://app.quillcrypt.dev/join/<workspace-id>#key=<encoded-key>`).

Two independent layers protect the key:

1. **Browser transport behavior**: fragments are never included in HTTP requests on
   navigation or `fetch()` — this is standard URL semantics, not something the app has to
   implement.
2. **Application-code discipline**: every network request builder in the app should be built
   from `origin + path` only (`buildApiRequestUrl()`), never from `url.href` or
   `url.toString()`. This is the layer that's actually in our control and worth enforcing with
   a lint rule or code review checklist, since layer 1 protects against *accidental* browser
   transmission, not against a developer explicitly doing something like `fetch(inviteUrl.href)`.

## Results against acceptance criteria

| AC | Result |
|---|---|
| Key visible in the fragment but absent from every captured request in devtools | **Pass** — see below for what "captured request" means in this spike |

Test run (6/6 passing):

```
PASS — invite link fragment contains the encoded key
PASS — invite link path/search do NOT contain the encoded key
PASS — extracted key round-trips correctly
PASS — sanity: the full href does contain the key (fragment is real, not stripped at creation)
PASS — none of the simulated network requests contain the key
PASS — documented risk: naively using url.href as a request target would include the key at the application-code level
```

The last test is deliberately named "documented risk" rather than a pass/fail on the app's
correctness — it exists to make the failure mode concrete: `url.href` **does** contain the key
(that's correct fragment behavior), and the real defense is never handing that value to a
request builder.

## Caveats / what's not yet proven

1. **This spike didn't capture real network traffic in devtools** — it's a structural/unit-level
   proof (the request-building function excludes the key) rather than an end-to-end browser
   test with an actual network panel inspection. Worth a manual devtools pass once the real
   extension has a join flow, as a final sanity check before Phase 3 ships.
2. **Late-joining members aren't covered here.** This spike is the *initial* key-generation and
   sharing flow only. QC-44 (Phase 3) needs asymmetric key wrapping so an existing member can
   add someone without re-sharing the raw key out-of-band — a materially harder problem than
   this spike.
3. **No enforcement mechanism yet** for the "never use url.href in a request" rule beyond this
   spike's own convention. Worth adding as an actual lint rule (e.g., a custom ESLint rule
   flagging `.href` usage near `fetch`/`WebSocket` calls) before Phase 1 ships real join-flow
   code, rather than relying on developers remembering.

## Setup to run the test

```bash
cd extension
npm install --save-dev libsodium-wrappers
node test/keyExchange.test.js
```
