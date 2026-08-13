'use strict';
const { startPersistentRelay } = require('./persistentRelay');

// Production relay entry point — uses the persistent relay (QC-37), which
// remembers each room's update history so clients catch up correctly on
// reconnect, on top of the blind-relay guarantees from QC-31/QC-2.
//
// NOTE: persistence here is in-memory only — it survives client
// disconnect/reconnect within one relay process lifetime, but a relay
// restart loses room history. True across-restart durability needs a real
// disk/database-backed store, which is out of scope for this phase.
//
// The non-persistent relay (relay.js, QC-31) remains available and tested
// separately — it's still the right building block for anything that
// doesn't need catch-up history (or a future variant with a different
// persistence backend).

const PORT = process.env.PORT || 8123;
startPersistentRelay(PORT);
console.log(`Quillcrypt relay (with persistence) listening on ws://localhost:${PORT}`);
