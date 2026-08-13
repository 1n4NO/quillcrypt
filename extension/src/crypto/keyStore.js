'use strict';
const { encodeKey, decodeKey } = require('./primitives');

/**
 * Local key storage (QC-46). Same pluggable-backend pattern as
 * AnnotationStore (QC-12) — swap InMemoryBackend for a
 * `browser.storage.local`-backed implementation for the real extension.
 *
 * Stores two things:
 *  - This device's own keypair (used to unwrap group keys sent via QC-44's
 *    member-invite flow)
 *  - The current group key for every workspace this device has joined
 *
 * THE TRADEOFF THIS TICKET EXISTS TO MAKE HONEST: if this storage is lost
 * (browser uninstall, device lost/wiped, profile corruption) without the
 * user having manually exported a backup, every workspace this device had
 * access to becomes permanently unreadable FROM THIS DEVICE. Other members
 * retain their own access — only this device's copy is gone. There is no
 * recovery mechanism and no escrow, by design: an E2EE product that COULD
 * recover your keys for you is a product whose operator (or an attacker
 * who compromises it) could also read your data. See
 * docs/KEY_RECOVERY.md for the plain-language, user-facing version of this
 * explanation.
 */

class InMemoryKeyBackend {
  constructor(sharedMap = new Map()) {
    this._map = sharedMap;
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

const DEVICE_KEYPAIR_KEY = 'device-keypair';
const WORKSPACE_KEY_PREFIX = 'workspace-key:';

class KeyStore {
  constructor(backend = new InMemoryKeyBackend()) {
    this.backend = backend;
  }

  async storeDeviceKeyPair(keyPair) {
    await this.backend.set(DEVICE_KEYPAIR_KEY, JSON.stringify({
      publicKey: encodeKey(keyPair.publicKey),
      privateKey: encodeKey(keyPair.privateKey),
    }));
  }

  async getDeviceKeyPair() {
    const stored = await this.backend.get(DEVICE_KEYPAIR_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return { publicKey: decodeKey(parsed.publicKey), privateKey: decodeKey(parsed.privateKey) };
  }

  async storeWorkspaceKey(workspaceId, key) {
    await this.backend.set(WORKSPACE_KEY_PREFIX + workspaceId, encodeKey(key));
  }

  async getWorkspaceKey(workspaceId) {
    const stored = await this.backend.get(WORKSPACE_KEY_PREFIX + workspaceId);
    return stored ? decodeKey(stored) : null;
  }

  async removeWorkspaceKey(workspaceId) {
    await this.backend.remove(WORKSPACE_KEY_PREFIX + workspaceId);
  }

  async listWorkspaceIds() {
    const allKeys = await this.backend.keys();
    return allKeys
      .filter((k) => k.startsWith(WORKSPACE_KEY_PREFIX))
      .map((k) => k.slice(WORKSPACE_KEY_PREFIX.length));
  }
}

module.exports = { KeyStore, InMemoryKeyBackend };
