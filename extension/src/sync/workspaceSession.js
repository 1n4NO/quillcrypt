'use strict';
const { AnnotationYDoc } = require('./annotationYDoc');
const { SyncClient } = require('./syncClient');
const { PresenceClient } = require('./presenceClient');
const { createEncryptedWebSocketImpl } = require('./encryptedTransport');
const { deriveRoomId } = require('../storage/workspace');

function roomUrl(relayUrl, roomId) {
  const url = new URL(relayUrl);
  url.searchParams.set('room', roomId);
  return url.toString();
}

/**
 * Live collaboration session for one unlocked workspace/page.
 * The session owns every network resource created for the page and exposes
 * only annotation records to the content-script renderer.
 */
class WorkspaceSession {
  constructor(workspace, key, relayUrl, options = {}) {
    this.workspace = workspace;
    this.key = key;
    this.relayUrl = relayUrl;
    this.WebSocketImpl = options.WebSocketImpl || (typeof WebSocket !== 'undefined' ? WebSocket : null);
    if (!this.WebSocketImpl) throw new Error('No WebSocket implementation available');

    this.annotationDoc = new AnnotationYDoc();
    this._listeners = new Set();
    this._onDocChange = (annotations) => this._listeners.forEach((listener) => listener(annotations));
    this._unsubscribeDoc = this.annotationDoc.observe(this._onDocChange);

    const encryptedWebSocket = createEncryptedWebSocketImpl(this.WebSocketImpl, key, options);
    const room = deriveRoomId(workspace);
    this.sync = new SyncClient(roomUrl(relayUrl, room), this.annotationDoc.ydoc, {
      WebSocketImpl: encryptedWebSocket,
      minBackoff: options.minBackoff,
      maxBackoff: options.maxBackoff,
      protocols: options.relayProtocols,
    });
    this.presence = new PresenceClient(roomUrl(relayUrl, `${room}:presence`), this.WebSocketImpl, {
      initialState: options.presenceState || {},
      protocols: options.relayProtocols,
    });
  }

  getAnnotations() { return this.annotationDoc.getAllAnnotations(); }
  getStatus() { return this.sync.getStatus(); }
  onAnnotationsChange(listener) {
    this._listeners.add(listener);
    listener(this.getAnnotations());
    return () => this._listeners.delete(listener);
  }
  onStatusChange(listener) { return this.sync.onStatusChange(listener); }
  addAnnotation(record) { this.annotationDoc.addAnnotation(record); }
  updateAnnotation(id, patch) { this.annotationDoc.updateAnnotation(id, patch); }
  deleteAnnotation(id) { this.annotationDoc.deleteAnnotation(id); }
  dispose() {
    this._unsubscribeDoc();
    this._listeners.clear();
    this.presence.dispose();
    this.sync.disconnect();
  }
}

module.exports = { WorkspaceSession, roomUrl };
