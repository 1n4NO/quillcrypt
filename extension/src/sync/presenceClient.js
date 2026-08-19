'use strict';

/**
 * Presence client (QC-33): live cursors / "who's viewing this page".
 *
 * Deliberately a SEPARATE channel from SyncClient (QC-32) rather than
 * multiplexed onto the same connection: presence is ephemeral (cursor
 * position, name, color — not meaningful to persist or CRDT-merge) while
 * document sync is durable. Keeping them separate means a presence bug
 * can't corrupt document state and vice versa, at the cost of one extra
 * WebSocket connection per client. Reuses the same blind relay (QC-31) via
 * a distinct room id (`${roomId}:presence`) — no relay changes needed.
 *
 * Peers are removed from the local view in two ways:
 *  - Immediately, if they send an explicit "leaving" message (clean dispose)
 *  - After `timeoutMs` of silence, if they disappear without saying so
 *    (crashed tab, network drop, etc) — detected by a periodic prune pass.
 */
class PresenceClient {
  constructor(url, WebSocketImpl, options = {}) {
    this.url = url;
    this.WebSocketImpl = WebSocketImpl;
    this.clientId = options.clientId || Math.random().toString(36).slice(2);
    this.heartbeatMs = options.heartbeatMs ?? 3000;
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.pruneIntervalMs = options.pruneIntervalMs ?? 1000;
    this.protocols = options.protocols;

    this._localState = options.initialState || {};
    this._peers = new Map(); // clientId -> { state, lastSeen }
    this._peerChangeListeners = new Set();

    this._ws = this.protocols ? new WebSocketImpl(url, this.protocols) : new WebSocketImpl(url);
    this._ws.addEventListener('open', () => {
      this._broadcast();
      this._heartbeatTimer = setInterval(() => this._broadcast(), this.heartbeatMs);
      this._pruneTimer = setInterval(() => this._pruneStalePeers(), this.pruneIntervalMs);
    });
    this._ws.addEventListener('message', (event) => this._handleMessage(event.data));
  }

  setLocalState(newState) {
    this._localState = { ...this._localState, ...newState };
    this._broadcast();
  }

  getPeers() {
    return [...this._peers.entries()].map(([clientId, entry]) => ({ clientId, state: entry.state }));
  }

  onPeersChange(listener) {
    this._peerChangeListeners.add(listener);
    return () => this._peerChangeListeners.delete(listener);
  }

  _emitPeersChange() {
    const peers = this.getPeers();
    this._peerChangeListeners.forEach((listener) => listener(peers));
  }

  _broadcast() {
    if (this._ws.readyState !== this.WebSocketImpl.OPEN) return;
    this._ws.send(JSON.stringify({ clientId: this.clientId, state: this._localState, type: 'presence' }));
  }

  _handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return; // ignore malformed/foreign messages
    }
    if (msg.clientId === this.clientId) return; // ignore our own broadcast, if the relay ever echoes it back

    if (msg.type === 'leaving') {
      if (this._peers.delete(msg.clientId)) this._emitPeersChange();
      return;
    }
    if (msg.type === 'presence') {
      this._peers.set(msg.clientId, { state: msg.state, lastSeen: Date.now() });
      this._emitPeersChange();
    }
  }

  _pruneStalePeers() {
    const now = Date.now();
    let changed = false;
    for (const [clientId, entry] of this._peers.entries()) {
      if (now - entry.lastSeen > this.timeoutMs) {
        this._peers.delete(clientId);
        changed = true;
      }
    }
    if (changed) this._emitPeersChange();
  }

  dispose() {
    clearInterval(this._heartbeatTimer);
    clearInterval(this._pruneTimer);
    if (this._ws.readyState === this.WebSocketImpl.OPEN) {
      this._ws.send(JSON.stringify({ clientId: this.clientId, type: 'leaving' }));
    }
    this._ws.close();
  }
}

module.exports = { PresenceClient };
