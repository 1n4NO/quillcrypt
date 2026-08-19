'use strict';

/**
 * Real browser.storage.local-backed adapter, implementing the exact same
 * {get, set, remove, keys} interface every InMemoryBackend throughout this
 * project already implements (AnnotationStore's, KeyStore's, MemberRoster's,
 * WorkspaceRegistry's). This is a drop-in replacement — none of those
 * already-tested classes need to change at all to use real storage.
 *
 * `namespace` prefixes every key, so e.g. annotation storage and key
 * storage can share the same browser.storage.local area without collisions
 * even though they're conceptually separate stores.
 */
class WebExtensionStorageBackend {
  constructor(namespace, storageArea = globalThis.browser?.storage?.local) {
    if (!storageArea) {
      throw new Error('browser.storage.local is not available in this environment');
    }
    this.namespace = namespace;
    this.storageArea = storageArea;
  }

  _key(key) {
    return `${this.namespace}:${key}`;
  }

  async get(key) {
    const result = await this.storageArea.get(this._key(key));
    const value = result[this._key(key)];
    return value === undefined ? null : value;
  }

  async set(key, value) {
    await this.storageArea.set({ [this._key(key)]: value });
  }

  async remove(key) {
    await this.storageArea.remove(this._key(key));
  }

  async keys() {
    const all = await this.storageArea.get(null);
    const prefix = `${this.namespace}:`;
    return Object.keys(all)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  }
}

/**
 * OnboardingState's backend has a different shape ({get(), add(step)} over
 * a fixed set, not a keyed store) — this adapts WebExtensionStorageBackend
 * to that shape by storing the completed-steps array under one fixed key.
 */
class WebExtensionOnboardingBackend {
  constructor(storageArea = globalThis.browser?.storage?.local) {
    this._backend = new WebExtensionStorageBackend('onboarding', storageArea);
  }
  async get() {
    const stored = await this._backend.get('completed-steps');
    return stored || [];
  }
  async add(step) {
    const current = await this.get();
    if (!current.includes(step)) {
      await this._backend.set('completed-steps', [...current, step]);
    }
  }
}

module.exports = { WebExtensionStorageBackend, WebExtensionOnboardingBackend };
