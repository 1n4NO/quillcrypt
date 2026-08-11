'use strict';
const WebSocket = require('ws');

/**
 * Blind WebSocket relay, hardened for production use on top of the QC-2
 * spike's core mechanism (forward opaque bytes, never decode/decrypt).
 *
 * Additions over the spike:
 *  - Rooms are cleaned up when their last client disconnects, so a
 *    long-running relay process doesn't accumulate empty room entries
 *    forever.
 *  - A failure sending to one peer (e.g. a half-closed socket) is caught
 *    and doesn't prevent broadcasting to the rest of the room.
 *  - getStats() exposes room/client counts for monitoring and testing —
 *    it reports counts only, never message content.
 */

/**
 * Broadcast `data` to every peer in `room` except `sender`. Extracted as a
 * standalone function (rather than inlined in the connection handler) so
 * the "one broken peer doesn't block the rest" behavior can be unit tested
 * directly with mock peer objects — the real server-side WebSocket
 * connections aren't reachable from outside the module for testing.
 */
function broadcastToRoom(room, sender, data) {
  for (const peer of room) {
    if (peer === sender || peer.readyState !== WebSocket.OPEN) continue;
    try {
      peer.send(data);
    } catch (err) {
      // One broken peer must not prevent delivery to the rest of the room.
      // Deliberately no content in this log — only that a send failed.
    }
  }
}

function startRelay(port) {
  const wss = new WebSocket.Server({ port });
  const rooms = new Map(); // roomId -> Set<ws>

  wss.on('connection', (ws, req) => {
    const roomId = new URL(req.url, 'http://localhost').searchParams.get('room') || 'default';
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(ws);

    ws.on('message', (data) => {
      const room = rooms.get(roomId);
      if (!room) return;
      broadcastToRoom(room, ws, data);
    });

    ws.on('close', () => {
      const room = rooms.get(roomId);
      if (!room) return;
      room.delete(ws);
      if (room.size === 0) {
        rooms.delete(roomId); // prevent unbounded growth of empty rooms
      }
    });
  });

  return {
    wss,
    close: () => wss.close(),
    getStats: () => ({
      roomCount: rooms.size,
      clientsPerRoom: Object.fromEntries([...rooms.entries()].map(([id, set]) => [id, set.size])),
    }),
  };
}

module.exports = { startRelay, broadcastToRoom };
