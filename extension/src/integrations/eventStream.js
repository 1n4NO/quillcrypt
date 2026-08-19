'use strict';
const subtle = globalThis.crypto?.subtle || null;

/**
 * Metadata-only event stream (QC-50).
 *
 * This is the boundary that QC-51 (Slack) and QC-52 (webhooks) build on
 * top of — it exists specifically so those integrations have NO code path
 * that could accidentally touch decrypted annotation content. An event
 * emitted here contains ONLY: event type, workspace id, a hash of the
 * page URL, the author's member id, the annotation id, and a timestamp.
 * Nothing else — no content, no anchor text, no style, no geometry.
 *
 * `EVENT_ALLOWED_KEYS` is deliberately exported so integration code (and
 * tests) can assert against it defensively, rather than trusting this
 * module never regresses.
 *
 * Uses the Web Crypto `subtle` API (via Node's `crypto.webcrypto.subtle` in
 * tests) rather than Node-specific crypto, since this same code needs to
 * run in a browser extension background script, where only Web Crypto is
 * available.
 */

const EVENT_ALLOWED_KEYS = ['type', 'workspaceId', 'urlHash', 'authorId', 'annotationId', 'timestamp'];

async function hashUrl(url) {
  if (!subtle) throw new Error('Web Crypto subtle API not available in this environment');
  const encoded = new TextEncoder().encode(url);
  const digest = await subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Throws if `event` contains any key outside the allowed whitelist. */
function assertMetadataOnly(event) {
  const keys = Object.keys(event);
  const disallowed = keys.filter((k) => !EVENT_ALLOWED_KEYS.includes(k));
  if (disallowed.length > 0) {
    throw new Error(`Event contains non-whitelisted key(s): ${disallowed.join(', ')} - this would leak content-adjacent data to integrations`);
  }
}

async function buildMetadataEvent({ type, workspaceId, url, authorId, annotationId }) {
  const event = {
    type,
    workspaceId,
    urlHash: await hashUrl(url),
    authorId: authorId || null,
    annotationId,
    timestamp: Date.now(),
  };
  assertMetadataOnly(event); // self-check before ever handing this to a caller
  return event;
}

/**
 * Wraps an AnnotationYDoc (QC-30) and emits metadata-only events whenever
 * an annotation is added, updated, or deleted. Detects the change TYPE by
 * diffing against its own last-known snapshot, since observeDeep alone
 * only reports "something changed", not what.
 */
class EventStream {
  constructor(annotationYDoc, { workspaceId, url, authorId }) {
    this.annotationYDoc = annotationYDoc;
    this.workspaceId = workspaceId;
    this.url = url;
    this.authorId = authorId;
    this._lastKnown = new Map(); // id -> shallow copy of last-seen record
    this._listeners = new Set();

    this._unsubscribe = annotationYDoc.observe((current) => this._handleChange(current));
  }

  onEvent(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  async _handleChange(currentAnnotations) {
    const currentIds = new Set(currentAnnotations.map((a) => a.id));

    for (const record of currentAnnotations) {
      const prev = this._lastKnown.get(record.id);
      if (!prev) {
        await this._emit('annotation-added', record.id);
      } else if (JSON.stringify(prev) !== JSON.stringify(record)) {
        await this._emit('annotation-updated', record.id);
      }
      this._lastKnown.set(record.id, record);
    }

    for (const id of [...this._lastKnown.keys()]) {
      if (!currentIds.has(id)) {
        await this._emit('annotation-deleted', id);
        this._lastKnown.delete(id);
      }
    }
  }

  async _emit(type, annotationId) {
    const event = await buildMetadataEvent({
      type,
      workspaceId: this.workspaceId,
      url: this.url,
      authorId: this.authorId,
      annotationId,
    });
    this._listeners.forEach((listener) => listener(event));
  }

  dispose() {
    this._unsubscribe();
  }
}

module.exports = { EventStream, buildMetadataEvent, assertMetadataOnly, hashUrl, EVENT_ALLOWED_KEYS };
