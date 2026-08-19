'use strict';
const { startPersistentRelay } = require('./persistentRelay');

// Production relay entry point — uses the persistent relay (QC-37), which
// remembers each room's update history so clients catch up correctly on
// reconnect, on top of the blind-relay guarantees from QC-31/QC-2.
//
// History is durable when RELAY_DATA_PATH is configured; leaving it unset
// preserves the lightweight in-memory mode used for local development.
//
// The non-persistent relay (relay.js, QC-31) remains available and tested
// separately — it's still the right building block for anything that
// doesn't need catch-up history (or a future variant with a different
// persistence backend).

const PORT = process.env.PORT || 8123;
const DATA_PATH = process.env.RELAY_DATA_PATH || null;
startPersistentRelay(PORT, { persistencePath: DATA_PATH });
console.log(`Quillcrypt relay (with persistence) listening on ws://localhost:${PORT}`);
