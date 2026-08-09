'use strict';

/**
 * Per-URL local persistence.
 *
 * Storage is behind a small interface (get/set/remove/keys) so the real
 * extension can back it with `browser.storage.local` — swap InMemoryBackend
 * for a WebExtensionBackend implementing the same three methods, nothing
 * else in this file needs to change. Annotations are keyed by a normalized
 * URL so the same logical page (regardless of hash fragment or query-param
 * ordering) always resolves to the same bucket.
 */

/** In-memory storage backend — same shape browser.storage.local would have. */
class InMemoryBackend {
  constructor(sharedMap = new Map()) {
    this._map = sharedMap; // shared so multiple instances can simulate "same disk"
  }
  async get(key) {
    return this._map.has(key) ? this._map.get(key) : null;
  }
  async set(key, value) {
    this._map.set(key, value);
  }
  async remove(key) {
    this._map.delete(key);
  }
  async keys() {
    return [...this._map.keys()];
  }
}

/**
 * Normalize a URL to a stable storage key: origin + pathname + sorted query
 * params. Fragment is deliberately dropped — annotations belong to the page,
 * not to a particular scroll-to-anchor state.
 */
function normalizeUrl(rawUrl) {
  const url = new URL(rawUrl);
  const sortedParams = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const search = sortedParams.length
    ? '?' + sortedParams.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : '';
  return `${url.origin}${url.pathname}${search}`;
}

class AnnotationStore {
  constructor(backend = new InMemoryBackend()) {
    this.backend = backend;
  }

  async getAnnotationsForUrl(rawUrl) {
    const key = normalizeUrl(rawUrl);
    const stored = await this.backend.get(key);
    return stored ? JSON.parse(stored) : [];
  }

  async addAnnotation(rawUrl, record) {
    const key = normalizeUrl(rawUrl);
    const existing = await this.getAnnotationsForUrl(rawUrl);
    existing.push(record);
    await this.backend.set(key, JSON.stringify(existing));
    return record;
  }

  async updateAnnotation(rawUrl, id, patch) {
    const key = normalizeUrl(rawUrl);
    const existing = await this.getAnnotationsForUrl(rawUrl);
    const idx = existing.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error(`Annotation ${id} not found for ${rawUrl}`);
    existing[idx] = { ...existing[idx], ...patch, updatedAt: new Date().toISOString() };
    await this.backend.set(key, JSON.stringify(existing));
    return existing[idx];
  }

  async deleteAnnotation(rawUrl, id) {
    const key = normalizeUrl(rawUrl);
    const existing = await this.getAnnotationsForUrl(rawUrl);
    const filtered = existing.filter((a) => a.id !== id);
    await this.backend.set(key, JSON.stringify(filtered));
  }
}

module.exports = { AnnotationStore, InMemoryBackend, normalizeUrl };
