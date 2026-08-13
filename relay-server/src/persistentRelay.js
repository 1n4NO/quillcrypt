'use strict';
const WebSocket = require('ws');
const Y = require('yjs');

/**
 * Relay with persistence (QC-37). Extends the QC-31 blind relay so a room
 * remembers the updates that passed through it, and replays them to any
 * client that connects — even one that was never online while those
 * updates happened. This is what closes the gap QC-32 explicitly could NOT
 * close on its own: QC-32 guarantees your own edits survive being offline,
 * but without this, you'd never receive updates OTHER clients made while
 * you were gone. With this, you do — and a client that's never connected
 * before catches up on full history too, not just reconnecting ones.
 *
 * IMPORTANT LIMITATION, stated plainly: this is IN-MEMORY persistence only.
 * It survives client disconnects/reconnects within one continuous relay
 * process lifetime, but a relay restart loses everything. True
 * across-restart durability needs a real disk/database-backed store — out
 * of scope here; this satisfies the ticket's stated goal ("offline clients
 * catch up on reconnect") without solving relay-crash recovery, which
 * would be a separate, larger piece of infrastructure work.
 *
 * The relay still never decodes update content — compaction uses
 * Y.mergeUpdates(), which operates on opaque Yjs update byte arrays without
 * needing to know what's inside them. Blindness is preserved.
 */

const COMPACTION_THRESHOLD = 50; // merge the log once it grows past this many entries

function startPersistentRelay(port, options = {}) {
  const compactionThreshold = options.compactionThreshold ?? COMPACTION_THRESHOLD;
  const wss = new WebSocket.Server({ port });
  const rooms = new Map(); // roomId -> Set<ws>
  const roomLogs = new Map(); // roomId -> Buffer[] (stored update history)

  function appendAndMaybeCompact(roomId, data) {
    const log = roomLogs.get(roomId) || [];
    log.push(Buffer.from(data));
    if (log.length > compactionThreshold) {
      const merged = Y.mergeUpdates(log);
      roomLogs.set(roomId, [Buffer.from(merged)]);
    } else {
      roomLogs.set(roomId, log);
    }
  }

  wss.on('connection', (ws, req) => {
    const roomId = new URL(req.url, 'http://localhost').searchParams.get('room') || 'default';
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(ws);

    // Catch-up: replay everything stored for this room to the new connection,
    // whether it's reconnecting after a drop or joining for the very first time.
    const history = roomLogs.get(roomId) || [];
    for (const update of history) {
      ws.send(update);
    }

    ws.on('message', (data) => {
      const room = rooms.get(roomId);
      if (room) {
        for (const peer of room) {
          if (peer === ws || peer.readyState !== WebSocket.OPEN) continue;
          try {
            peer.send(data);
          } catch (err) {
            // one broken peer must not block delivery to the rest — see QC-31
          }
        }
      }
      appendAndMaybeCompact(roomId, data);
    });

    ws.on('close', () => {
      const room = rooms.get(roomId);
      if (!room) return;
      room.delete(ws);
      if (room.size === 0) {
        rooms.delete(roomId); // live connections are cleaned up; roomLogs deliberately persist
      }
    });
  });

  return {
    wss,
    close: () => wss.close(),
    getStats: () => ({
      roomCount: rooms.size,
      logSizePerRoom: Object.fromEntries([...roomLogs.entries()].map(([id, log]) => [id, log.length])),
    }),
    // DEBUG-ONLY accessor, for tests that need to inspect exactly what's
    // persisted (e.g. QC-42's proof that no plaintext is ever stored). Not
    // part of the relay's real operational surface — never call this from
    // client code.
    _debugGetRoomLog: (roomId) => (roomLogs.get(roomId) || []).map((buf) => new Uint8Array(buf)),
  };
}

module.exports = { startPersistentRelay };
