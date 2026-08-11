'use strict';
const Y = require('yjs');

/**
 * Client sync layer (QC-32). Wraps a Y.Doc and a WebSocket connection to
 * the relay, handling:
 *  - sending local Yjs updates over the wire, queueing them if disconnected
 *  - applying remote updates received from the relay
 *  - automatic reconnect with exponential backoff on disconnect
 *  - avoiding echo loops (a remote-applied update must not be re-sent)
 *
 * WebSocketImpl is injectable specifically so the same code works in both
 * a real browser content script (native global WebSocket) and in Node
 * tests (the `ws` package) — this is the same pattern used throughout this
 * project for anything that needs a real network/DOM API.
 *
 * SCOPE NOTE: this does NOT guarantee catching up on updates broadcast by
 * OTHER clients while this client was offline — the relay (QC-31) doesn't
 * persist anything, so a message broadcast while you're disconnected is
 * simply gone. Guaranteeing catch-up requires relay-side persistence,
 * which is QC-37, a separate ticket. What this DOES guarantee: your own
 * local edits made while offline are queued and delivered once you
 * reconnect, so you never silently lose your own work.
 */
class SyncClient {
  constructor(url, ydoc, options = {}) {
    this.url = url;
    this.ydoc = ydoc;
    this.WebSocketImpl = options.WebSocketImpl || (typeof WebSocket !== 'undefined' ? WebSocket : null);
    if (!this.WebSocketImpl) throw new Error('No WebSocket implementation available — pass options.WebSocketImpl');

    this.minBackoff = options.minBackoff ?? 500;
    this.maxBackoff = options.maxBackoff ?? 30000;
    this.backoffFactor = options.backoffFactor ?? 2;

    this._queue = [];
    this._ws = null;
    this._manualClose = false;
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;
    this._statusListeners = new Set();
    this._status = 'connecting';

    this._onLocalUpdate = (update, origin) => {
      if (origin === 'remote') return; // never re-send what we just received
      this._sendOrQueue(update);
    };
    this.ydoc.on('update', this._onLocalUpdate);

    this._connect();
  }

  getStatus() {
    return this._status;
  }

  onStatusChange(listener) {
    this._statusListeners.add(listener);
    return () => this._statusListeners.delete(listener);
  }

  _setStatus(status) {
    this._status = status;
    this._statusListeners.forEach((listener) => listener(status));
  }

  _connect() {
    this._setStatus(this._reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    const ws = new this.WebSocketImpl(this.url);
    this._ws = ws;

    ws.addEventListener('open', () => {
      this._reconnectAttempt = 0;
      this._setStatus('open');
      this._flushQueue();
    });

    ws.addEventListener('message', (event) => {
      const data = event.data;
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      Y.applyUpdate(this.ydoc, bytes, 'remote');
    });

    ws.addEventListener('close', () => {
      this._ws = null;
      if (this._manualClose) {
        this._setStatus('closed');
        return;
      }
      this._scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      // 'close' always follows 'error' for WebSocket — no separate handling needed.
    });
  }

  _scheduleReconnect() {
    const delay = Math.min(this.minBackoff * this.backoffFactor ** this._reconnectAttempt, this.maxBackoff);
    this._reconnectAttempt++;
    this._setStatus('reconnecting');
    this._reconnectTimer = setTimeout(() => this._connect(), delay);
  }

  _sendOrQueue(update) {
    if (this._ws && this._ws.readyState === this.WebSocketImpl.OPEN) {
      this._ws.send(update);
    } else {
      this._queue.push(update);
    }
  }

  _flushQueue() {
    while (this._queue.length > 0) {
      const update = this._queue.shift();
      this._ws.send(update);
    }
  }

  /** Simulate/force a disconnect without a full manual close — for testing reconnect. */
  _forceDisconnect() {
    if (this._ws) this._ws.close();
  }

  disconnect() {
    this._manualClose = true;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this._ws) this._ws.close();
    this.ydoc.off('update', this._onLocalUpdate);
  }
}

module.exports = { SyncClient };
