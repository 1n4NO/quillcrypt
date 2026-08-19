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
const AUTH_TOKEN = process.env.RELAY_AUTH_TOKEN || null;
const ALLOWED_ORIGINS = process.env.RELAY_ALLOWED_ORIGINS
  ? process.env.RELAY_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : null;
const MAX_PAYLOAD = Number(process.env.RELAY_MAX_PAYLOAD || 1024 * 1024);
const MAX_ROOMS = Number(process.env.RELAY_MAX_ROOMS || Infinity);
const MAX_CLIENTS_PER_ROOM = Number(process.env.RELAY_MAX_CLIENTS_PER_ROOM || Infinity);
const HEARTBEAT_INTERVAL = Number(process.env.RELAY_HEARTBEAT_INTERVAL || 30000);
startPersistentRelay(PORT, {
  persistencePath: DATA_PATH,
  authToken: AUTH_TOKEN,
  allowedOrigins: ALLOWED_ORIGINS,
  maxPayload: MAX_PAYLOAD,
  maxRooms: MAX_ROOMS,
  maxClientsPerRoom: MAX_CLIENTS_PER_ROOM,
  heartbeatIntervalMs: HEARTBEAT_INTERVAL,
});
console.log(`Quillcrypt relay (with persistence) listening on ws://localhost:${PORT}`);
