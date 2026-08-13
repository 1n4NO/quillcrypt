'use strict';
const { encryptSymmetric, decryptSymmetric } = require('../crypto/primitives');

/**
 * Encrypted transport (QC-42): wraps a real WebSocket implementation so
 * every outgoing byte is encrypted and every incoming byte is decrypted,
 * completely transparently to whatever's using it.
 *
 * DESIGN CHOICE: rather than modifying SyncClient (QC-32) to know about
 * encryption, this produces a drop-in replacement for the `WebSocketImpl`
 * option SyncClient already accepts. SyncClient continues to just see
 * "bytes in, bytes out" over something WebSocket-shaped — it has zero
 * awareness that encryption is happening. This means:
 *   - SyncClient's existing tests (reconnect, offline queue, echo
 *     prevention) all remain valid unchanged; encryption is orthogonal to
 *     everything they verify.
 *   - The relay's blindness guarantee (QC-31/QC-37) is preserved
 *     automatically: the relay only ever sees what this transport sends,
 *     which is always ciphertext.
 *
 * A message that fails to decrypt (wrong key, corrupted data) is dropped
 * silently rather than crashing the client — this is a robustness choice,
 * not a security assumption. `onDecryptError` is available for telemetry
 * without ever exposing which bytes failed or why.
 */
function createEncryptedWebSocketImpl(RealWebSocketImpl, key, options = {}) {
  const onDecryptError = options.onDecryptError || (() => {});

  return class EncryptedWebSocket {
    constructor(url) {
      this._ws = new RealWebSocketImpl(url);
      this._listeners = { open: [], message: [], close: [], error: [] };

      this._ws.addEventListener('open', (e) => this._emit('open', e));
      this._ws.addEventListener('close', (e) => this._emit('close', e));
      this._ws.addEventListener('error', (e) => this._emit('error', e));
      this._ws.addEventListener('message', (event) => {
        const raw = event.data;
        const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
        let plaintext;
        try {
          plaintext = decryptSymmetric(bytes, key);
        } catch (err) {
          onDecryptError(err);
          return; // drop — do not surface undecryptable bytes to SyncClient at all
        }
        this._emit('message', { data: plaintext });
      });
    }

    addEventListener(type, fn) {
      this._listeners[type].push(fn);
    }
    removeEventListener(type, fn) {
      this._listeners[type] = this._listeners[type].filter((f) => f !== fn);
    }
    _emit(type, event) {
      this._listeners[type].forEach((fn) => fn(event));
    }

    send(data) {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      const encrypted = encryptSymmetric(bytes, key);
      this._ws.send(encrypted);
    }

    close() {
      this._ws.close();
    }

    get readyState() {
      return this._ws.readyState;
    }

    static get OPEN() {
      return RealWebSocketImpl.OPEN;
    }
  };
}

module.exports = { createEncryptedWebSocketImpl };
