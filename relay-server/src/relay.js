'use strict';
const WebSocket = require('ws');

/**
 * A relay that is provably blind: it never parses, decrypts, or logs message
 * *content* — only enough metadata (room id) to route. Every inbound binary
 * message is broadcast verbatim to every other client in the same room.
 *
 * Spike results: docs/spikes/QC-2-encrypted-relay.md
 */
function startRelay(port) {
  const wss = new WebSocket.Server({ port });
  const rooms = new Map(); // roomId -> Set<ws>

  wss.on('connection', (ws, req) => {
    const roomId = new URL(req.url, 'http://localhost').searchParams.get('room') || 'default';
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(ws);

    ws.on('message', (data) => {
      // The relay's entire job: forward opaque bytes. No decode, no decrypt,
      // no logging of content — see QC-42 (Phase 3) for the automated test
      // that enforces this in the real relay implementation.
      for (const peer of rooms.get(roomId)) {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
          peer.send(data);
        }
      }
    });

    ws.on('close', () => {
      rooms.get(roomId)?.delete(ws);
    });
  });

  return {
    wss,
    close: () => wss.close(),
  };
}

module.exports = { startRelay };
