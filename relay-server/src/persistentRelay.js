'use strict';
const WebSocket = require('ws');
const Y = require('yjs');
const fs = require('fs');
const path = require('path');
const http = require('http');

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
 * The relay still never decodes update content — compaction uses
 * Y.mergeUpdates(), which operates on opaque Yjs update byte arrays without
 * needing to know what's inside them. Blindness is preserved.
 */

const COMPACTION_THRESHOLD = 50; // merge the log once it grows past this many entries

function startPersistentRelay(port, options = {}) {
  const compactionThreshold = options.compactionThreshold ?? COMPACTION_THRESHOLD;
  const persistencePath = options.persistencePath || null;
  const maxPayload = options.maxPayload ?? 1024 * 1024;
  const authToken = options.authToken || null;
  const allowedOrigins = options.allowedOrigins || null;
  const maxRooms = options.maxRooms ?? Infinity;
  const maxClientsPerRoom = options.maxClientsPerRoom ?? Infinity;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30000;
  const maxMessagesPerInterval = options.maxMessagesPerInterval ?? Infinity;
  const rateIntervalMs = options.rateIntervalMs ?? 1000;
  const healthPort = options.healthPort ?? null;
  const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 5000;
  const authProtocol = authToken ? `quillcrypt-auth.${authToken}` : null;
  const wss = new WebSocket.Server({
    port,
    maxPayload,
    handleProtocols: (protocols) => {
      const requested = Array.from(protocols);
      return requested.find((protocol) => protocol === authProtocol) || requested[0] || '';
    },
    verifyClient: ({ origin, req }, done) => {
      if (allowedOrigins && !allowedOrigins.includes(origin)) return done(false, 403, 'Origin not allowed');
      const requestedProtocols = String(req.headers['sec-websocket-protocol'] || '')
        .split(',').map((protocol) => protocol.trim()).filter(Boolean);
      const headerAuthorized = req.headers.authorization === `Bearer ${authToken}`;
      const protocolAuthorized = authToken && requestedProtocols.includes(authProtocol);
      if (authToken && !headerAuthorized && !protocolAuthorized) return done(false, 401, 'Unauthorized');
      done(true);
    },
  });
  const rooms = new Map(); // roomId -> Set<ws>
  const roomLogs = loadRoomLogs(persistencePath);
  const healthServer = healthPort === null ? null : http.createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/healthz') {
      res.writeHead(404); res.end(); return;
    }
    let storageReady = true;
    if (persistencePath) {
      try { fs.accessSync(path.dirname(persistencePath), fs.constants.W_OK); } catch { storageReady = false; }
    }
    const clients = [...rooms.values()].reduce((total, room) => total + room.size, 0);
    const ready = Boolean(wss._server?.listening) && storageReady;
    res.writeHead(ready ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: ready, persistent: Boolean(persistencePath), storageReady, rooms: rooms.size, clients }));
  });
  healthServer?.listen(healthPort);

  function persistRoomLogs() {
    if (!persistencePath) return;
    const payload = Object.fromEntries([...roomLogs.entries()].map(([roomId, log]) => [
      roomId, log.map((update) => Buffer.from(update).toString('base64')),
    ]));
    const directory = path.dirname(persistencePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryPath = `${persistencePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify({ version: 1, rooms: payload }), 'utf8');
    fs.renameSync(temporaryPath, persistencePath);
  }

  function appendAndMaybeCompact(roomId, data) {
    const log = roomLogs.get(roomId) || [];
    log.push(Buffer.from(data));
    if (log.length > compactionThreshold) {
      const merged = Y.mergeUpdates(log);
      roomLogs.set(roomId, [Buffer.from(merged)]);
    } else {
      roomLogs.set(roomId, log);
    }
    persistRoomLogs();
  }

  wss.on('connection', (ws, req) => {
    const roomId = new URL(req.url, 'http://localhost').searchParams.get('room') || 'default';
    if (!rooms.has(roomId) && rooms.size >= maxRooms) {
      ws.close(1008, 'Room limit reached');
      return;
    }
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    const room = rooms.get(roomId);
    if (room.size >= maxClientsPerRoom) {
      ws.close(1008, 'Client limit reached');
      if (room.size === 0) rooms.delete(roomId);
      return;
    }
    room.add(ws);
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    let windowStartedAt = Date.now();
    let messageCount = 0;

    // Catch-up: replay everything stored for this room to the new connection,
    // whether it's reconnecting after a drop or joining for the very first time.
    const history = roomLogs.get(roomId) || [];
    for (const update of history) {
      ws.send(update);
    }

    ws.on('message', (data) => {
      const now = Date.now();
      if (now - windowStartedAt >= rateIntervalMs) {
        windowStartedAt = now;
        messageCount = 0;
      }
      messageCount += 1;
      if (messageCount > maxMessagesPerInterval) {
        ws.close(1008, 'Message rate limit exceeded');
        return;
      }
      const room = rooms.get(roomId);
      appendAndMaybeCompact(roomId, data);
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

  const heartbeatTimer = heartbeatIntervalMs > 0 ? setInterval(() => {
    for (const room of rooms.values()) {
      for (const ws of room) {
        if (ws.isAlive === false) { ws.terminate(); continue; }
        ws.isAlive = false;
        ws.ping();
      }
    }
  }, heartbeatIntervalMs) : null;
  heartbeatTimer?.unref?.();

  return {
    wss,
    healthServer,
    close: () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (healthServer?.listening) healthServer.close();
      return wss.close();
    },
    shutdown: async () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      for (const room of rooms.values()) for (const ws of room) ws.close(1001, 'Relay shutting down');
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, shutdownTimeoutMs);
        timer.unref?.();
        wss.close(() => { clearTimeout(timer); resolve(); });
      });
      for (const room of rooms.values()) for (const ws of room) ws.terminate();
      if (healthServer?.listening) await new Promise((resolve) => healthServer.close(resolve));
    },
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

function loadRoomLogs(persistencePath) {
  if (!persistencePath || !fs.existsSync(persistencePath)) return new Map();
  try {
    const parsed = JSON.parse(fs.readFileSync(persistencePath, 'utf8'));
    if (parsed.version !== 1 || !parsed.rooms || typeof parsed.rooms !== 'object') return new Map();
    return new Map(Object.entries(parsed.rooms).map(([roomId, updates]) => [
      roomId,
      Array.isArray(updates) ? updates.map((encoded) => Buffer.from(encoded, 'base64')) : [],
    ]));
  } catch {
    // A corrupt or partially-written history must not prevent the relay from
    // starting. Atomic replacement means this should only happen after manual
    // tampering or a filesystem failure; the relay starts empty and can rebuild.
    return new Map();
  }
}

module.exports = { startPersistentRelay };
