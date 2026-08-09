# QC-2 — Spike: encrypted Yjs updates over a blind relay

**Status: done.** Relay implementation at `relay-server/src/relay.js`, entry point at
`relay-server/src/index.js`, test at `relay-server/test/relay.test.js`.

## Approach

Two independent Yjs documents (`docA`, `docB`) simulate two browser clients. Each client:

1. Listens for local Yjs `update` events
2. Encrypts the raw update bytes with `libsodium` `crypto_secretbox_easy` (XSalsa20-Poly1305)
   under a shared workspace symmetric key, prefixing the nonce
3. Sends the ciphertext over a plain WebSocket to the relay

The relay (`relay-server/src/relay.js`) does exactly one thing: forward inbound binary
messages verbatim to every other client in the same room. It never calls into Yjs or
libsodium — there's no code path in the relay that *could* decode or decrypt, by construction,
not just by convention.

A third, silent WebSocket connection joins the same room purely to observe what bytes actually
cross the wire, independent of either real client's own bookkeeping — this is what the test
asserts against, to avoid the spike "grading its own homework."

## Results against acceptance criteria

| AC | Result |
|---|---|
| Two browser tabs (simulated as two Yjs docs) converge to the same document state | **Pass** |
| Relay process, when inspected, never has plaintext content in memory or logs | **Pass**, verified two ways below |

Test run (6/6 passing):

```
PASS — doc B converged to match doc A after A's edit
PASS — doc A converged to match doc B after B's edit
PASS — final merged content is as expected
PASS — observer saw at least one relayed message
PASS — bytes crossing the relay never exactly match any plaintext Yjs update
PASS — bytes crossing the relay do not parse as a valid Yjs update (they are ciphertext)
```

The last two are the load-bearing assertions for the E2EE claim:

- **Byte-for-byte check**: none of the bytes observed crossing the relay match any plaintext
  Yjs update that was actually produced client-side.
- **Structural check**: none of the observed bytes even *parse* as a valid Yjs update
  (`Y.decodeUpdate` throws on all of them) — so it's not just that the bytes differ, it's that
  what the relay sees isn't a CRDT delta at all, it's ciphertext.

Combined with the relay's source containing no `require('yjs')` or `require('libsodium...')` at
all, this is reasonably strong evidence the relay is blind by construction, not just blind in
this particular test run.

## Caveats / what this spike does *not* prove

1. **This is an in-memory relay with no persistence.** QC-37 (Phase 2, relay persistence for
   offline-client catch-up) will add a storage layer — that's a new place plaintext could
   theoretically leak if implemented carelessly (e.g. logging middleware, debug dumps). QC-42
   in Phase 3 should re-run an equivalent "never saw plaintext" check against the *production*
   relay, including its logs, not just this spike's minimal version.
2. **No key rotation/late-join tested yet.** This spike uses one static key generated once.
   QC-44 (asymmetric key wrapping for late-joining members) is separate, harder work.
3. **No adversarial testing.** This proves the happy path is blind; it doesn't attempt traffic
   analysis resistance (message timing/size could still leak some metadata about editing
   activity — out of scope for E2EE-of-content, worth a line in the privacy policy in QC-65).

## Setup to run the test

```bash
cd relay-server
npm install
npm test
```
