'use strict';
const { startRelay } = require('./relay');

// Blind WebSocket relay entry point.
//
// By design this process should NEVER decrypt or inspect message payloads —
// it only forwards opaque binary blobs between clients in the same workspace
// (room). See docs/spikes/QC-2-encrypted-relay.md for the spike that proved
// this works end-to-end with encrypted Yjs updates, and QC-42 (Phase 3) for
// the automated test that will enforce blindness in CI.

const PORT = process.env.PORT || 8123;
startRelay(PORT);
console.log(`Quillcrypt relay listening on ws://localhost:${PORT}`);
